package com.example.restnestadmin.api

import com.example.restnestadmin.Order
import com.google.gson.annotations.SerializedName
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.DELETE
import retrofit2.http.Body
import retrofit2.http.Path

data class OrdersResponse(val success: Boolean, val orders: List<Order>)
data class SimpleResponse(val success: Boolean, val message: String? = null)
data class DeleteOrdersRequest(val ids: List<String>)

data class PushSingleOrderRequest(val orderId: String)
data class PushSelectedOrdersRequest(val orderIds: List<String>)
data class BigShipPushResponse(
    val success: Boolean,
    val message: String? = null,
    val shipment_id: String? = null,
    val awb: String? = null,
    val error: String? = null
)

data class UpdateBulkStatusRequest(
    val status: String
)

data class BulkOrder(
    @SerializedName("id") private val _id: String? = null,
    @SerializedName("first_name") private val _first_name: String? = null,
    @SerializedName("last_name") private val _last_name: String? = null,
    @SerializedName("email") private val _email: String? = null,
    @SerializedName("phone") private val _phone: String? = null,
    @SerializedName("business_name") private val _business_name: String? = null,
    @SerializedName("quantity") private val _quantity: Any? = null,
    @SerializedName("status") private val _status: String? = null,
    @SerializedName("created_at") private val _created_at: String? = null,
    @SerializedName("address") private val _address: String? = null,
    @SerializedName("city") private val _city: String? = null,
    @SerializedName("state") private val _state: String? = null,
    @SerializedName("pincode") private val _pincode: String? = null,
    @SerializedName("notes") private val _notes: String? = null
) {
    val id: String get() = _id.orEmpty()
    val first_name: String get() = _first_name.orEmpty()
    val last_name: String get() = _last_name.orEmpty()
    val email: String get() = _email.orEmpty()
    val phone: String get() = _phone.orEmpty()
    val business_name: String get() = if (!_business_name.isNullOrBlank()) _business_name else "Wholesale Inquiry"
    val quantity: Int get() = when (val q = _quantity) {
        is Number -> q.toInt()
        is String -> q.toDoubleOrNull()?.toInt() ?: 50
        else -> 50
    }
    val status: String get() = if (!_status.isNullOrBlank()) _status else "Pending"
    val created_at: String get() = _created_at.orEmpty()
    val address: String get() = _address.orEmpty()
    val city: String get() = _city.orEmpty()
    val state: String get() = _state.orEmpty()
    val pincode: String get() = _pincode.orEmpty()
    val notes: String get() = _notes.orEmpty()

    val customerName: String
        get() = "$first_name $last_name".trim().ifEmpty { "Customer" }
}

data class BulkOrdersResponse(
    val success: Boolean = false,
    val bulkOrders: List<BulkOrder>? = emptyList()
)

interface RestNestApi {
    @GET("api/orders")
    suspend fun getOrders(): OrdersResponse

    @GET("api/bulk-orders")
    suspend fun getBulkOrders(): BulkOrdersResponse

    @POST("api/bulk-orders/{id}/status")
    suspend fun updateBulkOrderStatus(
        @Path("id") id: String,
        @Body body: UpdateBulkStatusRequest
    ): SimpleResponse

    @DELETE("api/bulk-orders/{id}")
    suspend fun deleteBulkOrder(
        @Path("id") id: String
    ): SimpleResponse

    @DELETE("api/delete-order/{id}")
    suspend fun deleteOrder(@Path("id") id: String): SimpleResponse

    @POST("api/delete-orders")
    suspend fun deleteMultipleOrders(@Body body: DeleteOrdersRequest): SimpleResponse

    @DELETE("api/reset-orders")
    suspend fun resetAllOrders(): SimpleResponse

    @POST("api/retry-shipment")
    suspend fun pushSingleOrderToBigShip(@Body body: PushSingleOrderRequest): BigShipPushResponse

    @POST("api/push-selected-to-bigship")
    suspend fun pushSelectedOrdersToBigShip(@Body body: PushSelectedOrdersRequest): BigShipPushResponse

    @POST("api/push-all-unbooked-to-bigship")
    suspend fun pushAllUnbookedOrdersToBigShip(): BigShipPushResponse
}

object RetrofitClient {
    private const val BASE_URL = "https://restienestie.onrender.com/"
    
    val instance: RestNestApi by lazy {
        val retrofit = Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        retrofit.create(RestNestApi::class.java)
    }
}
