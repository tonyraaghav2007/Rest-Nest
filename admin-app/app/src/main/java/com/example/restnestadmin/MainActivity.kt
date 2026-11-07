package com.example.restnestadmin

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.launch
import com.example.restnestadmin.theme.RestNestAdminTheme
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.io.OutputStreamWriter
import java.util.Scanner
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.DocumentChange
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.activity.result.contract.ActivityResultContracts
import kotlinx.coroutines.flow.MutableStateFlow

import com.example.restnestadmin.api.RetrofitClient
import com.example.restnestadmin.api.BulkOrder
import com.example.restnestadmin.api.UpdateBulkStatusRequest
import androidx.compose.ui.platform.LocalContext
import android.net.Uri
import kotlinx.coroutines.delay
import com.google.gson.annotations.SerializedName
import android.widget.Toast


// ──────────────────── Data Classes ────────────────────
data class Order(
    @SerializedName("id")
    val id: String = "",

    @SerializedName(value = "customerName", alternate = ["customer_name", "name"])
    val customerName: String = "",

    @SerializedName("address")
    val address: String = "",

    @SerializedName("phone")
    val phone: String = "",

    @SerializedName(value = "amount", alternate = ["total_amount", "total"])
    val amount: Double = 0.0,

    @SerializedName("items")
    val items: String = "",

    @SerializedName("rawItems")
    val rawItems: String = "[]",

    @SerializedName("status")
    val status: String = "Placed",

    @SerializedName("date")
    val date: String = "",

    @SerializedName(value = "createdAt", alternate = ["created_at"])
    val createdAt: Long = 0L,

    @SerializedName(value = "paymentMethod", alternate = ["payment_method"])
    val paymentMethod: String = "Unknown",

    @SerializedName(value = "paymentId", alternate = ["payment_id"])
    val paymentId: String = "N/A",

    @SerializedName(value = "bigshipAwb", alternate = ["bigship_awb"])
    val bigshipAwb: String = "N/A",

    @SerializedName(value = "shiprocketAwb", alternate = ["shiprocket_awb"])
    val shiprocketAwb: String = "N/A",

    @SerializedName(value = "bigshipStatus", alternate = ["bigship_status"])
    val bigshipStatus: String = "Pending"
)

data class ProductSale(val name: String, val amount: Double, val color: Color)

data class PageVisit(val pageName: String, val visits: Int, val color: Color)

// ──────────────────── Theme Colors Helper ────────────────────
data class AppColors(
    val background: Color,
    val surface: Color,
    val cardBg: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val accent: Color,
    val tableHeader: Color,
    val divider: Color,
    val navBarBgColors: List<Color>
)

val DarkAppColors = AppColors(
    background = Color(0xFF0D0D14),
    surface = Color(0xFF1A1A2E),
    cardBg = Color(0x22FFFFFF),
    textPrimary = Color.White,
    textSecondary = Color(0xFFAAAAAA),
    accent = Color(0xFF00E5FF),
    tableHeader = Color(0xFF232336),
    divider = Color(0x11FFFFFF),
    navBarBgColors = listOf(Color(0x44FFFFFF), Color(0x11FFFFFF))
)

val LightAppColors = AppColors(
    background = Color(0xFFF5F5FA),
    surface = Color.White,
    cardBg = Color(0x11000000),
    textPrimary = Color(0xFF1A1A2E),
    textSecondary = Color(0xFF666680),
    accent = Color(0xFF0077CC),
    tableHeader = Color(0xFFE8E8F0),
    divider = Color(0x22000000),
    navBarBgColors = listOf(Color(0xDDFFFFFF), Color(0xAAFFFFFF))
)

// ──────────────────── Activity ────────────────────
class MainActivity : ComponentActivity() {

    private val orderIdToOpen = MutableStateFlow<String?>(null)
    private var isFirstSnapshot = true

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        
        // Notifications Setup
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel("orders", "Orders", NotificationManager.IMPORTANCE_HIGH)
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        intent.getStringExtra("order_id")?.let {
            orderIdToOpen.value = it
        }

        setContent {
            var isDarkTheme by remember { mutableStateOf(true) }
            val currentOrderId by orderIdToOpen.collectAsState()
            
            RestNestAdminTheme(darkTheme = isDarkTheme, dynamicColor = false) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = if (isDarkTheme) DarkAppColors.background else LightAppColors.background
                ) {
                    AdminApp(
                        isDarkTheme = isDarkTheme,
                        onThemeToggle = { isDarkTheme = !isDarkTheme },
                        orderIdToOpen = currentOrderId,
                        onOrderOpened = { orderIdToOpen.value = null },
                        context = this@MainActivity,
                        isFirstSnapshotRef = { isFirst -> 
                            if (isFirst != null) {
                                isFirstSnapshot = isFirst
                                isFirst
                            } else {
                                isFirstSnapshot
                            }
                        }
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent.getStringExtra("order_id")?.let {
            orderIdToOpen.value = it
        }
    }

    fun sendOrderNotification(orderId: String, customerName: String, amount: Double) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("order_id", orderId)
        }
        val pendingIntent = PendingIntent.getActivity(this, orderId.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val notification = NotificationCompat.Builder(this, "orders")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Order Received!")
            .setContentText("$customerName just placed an order for Rs. $amount")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(orderId.hashCode(), notification)
    }
}

// ──────────────────── Main App ────────────────────
@Composable
fun AdminApp(
    isDarkTheme: Boolean, 
    onThemeToggle: () -> Unit,
    orderIdToOpen: String?,
    onOrderOpened: () -> Unit,
    context: MainActivity,
    isFirstSnapshotRef: (Boolean?) -> Boolean
) {
    val colors = if (isDarkTheme) DarkAppColors else LightAppColors
    var currentTab by remember { mutableStateOf("Dashboard") }
    var selectedOrder by remember { mutableStateOf<Order?>(null) }
    val orders = remember { mutableStateListOf<Order>() }
    val scope = rememberCoroutineScope()
    var refreshTrigger by remember { mutableIntStateOf(0) }
    
    LaunchedEffect(orderIdToOpen, orders.size) {
        if (orderIdToOpen != null && selectedOrder == null) {
            val found = orders.find { it.id == orderIdToOpen }
            if (found != null) {
                selectedOrder = found
                onOrderOpened()
            }
        }
    }

    LaunchedEffect(refreshTrigger) {
        while(true) {
            try {
                val response = RetrofitClient.instance.getOrders()
                if (response.success) {
                    val newOrders = response.orders.map { apiOrder -> 
                        Order(
                            id = apiOrder.id,
                            customerName = apiOrder.customerName ?: "",
                            address = apiOrder.address ?: "",
                            phone = apiOrder.phone ?: "",
                            amount = apiOrder.amount ?: 0.0,
                            items = apiOrder.items ?: "",
                            rawItems = apiOrder.rawItems ?: "[]",
                            status = apiOrder.status ?: "Placed",
                            date = apiOrder.date ?: "",
                            createdAt = apiOrder.createdAt ?: System.currentTimeMillis(),
                            paymentMethod = apiOrder.paymentMethod ?: "Unknown",
                            paymentId = apiOrder.paymentId ?: "N/A",
                            bigshipAwb = apiOrder.bigshipAwb.takeIf { it != "N/A" } ?: apiOrder.shiprocketAwb ?: "N/A",
                            shiprocketAwb = apiOrder.bigshipAwb.takeIf { it != "N/A" } ?: apiOrder.shiprocketAwb ?: "N/A",
                            bigshipStatus = apiOrder.bigshipStatus
                        )
                    }
                    
                    val isFirst = isFirstSnapshotRef(null)
                    if (!isFirst && orders.isNotEmpty()) {
                        val oldIds = orders.map { it.id }.toSet()
                        newOrders.forEach { no ->
                            if (!oldIds.contains(no.id)) {
                                context.sendOrderNotification(no.id, no.customerName, no.amount)
                            }
                        }
                    }
                    isFirstSnapshotRef(false)
                    
                    orders.clear()
                    orders.addAll(newOrders)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
            delay(10000) // Poll every 10 seconds
        }
    }

    val tabs = listOf("Dashboard", "Orders", "Bulk", "Settings")
    val icons = listOf(Icons.Filled.Home, Icons.Filled.List, Icons.Filled.ShoppingCart, Icons.Filled.Settings)

    Scaffold(
        containerColor = Color.Transparent,
        bottomBar = {
            if (selectedOrder == null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 24.dp, end = 24.dp, bottom = 8.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .background(
                            Brush.verticalGradient(colors = colors.navBarBgColors)
                        )
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    tabs.forEachIndexed { index, title ->
                        val isSelected = currentTab == title
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier
                                .clip(RoundedCornerShape(14.dp))
                                .background(if (isSelected) colors.accent.copy(alpha = 0.15f) else Color.Transparent)
                                .clickable { currentTab = title }
                                .padding(horizontal = 20.dp, vertical = 6.dp)
                        ) {
                            Icon(
                                icons[index],
                                contentDescription = title,
                                tint = if (isSelected) colors.accent else colors.textSecondary,
                                modifier = Modifier.size(22.dp)
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                title,
                                fontSize = 11.sp,
                                color = if (isSelected) colors.accent else colors.textSecondary,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    }
                }
            }
        }
    ) { innerPadding ->
        Box(modifier = Modifier
            .padding(innerPadding)
            .fillMaxSize()) {
            AnimatedContent(
                targetState = selectedOrder,
                label = "OrderTransition"
            ) { targetOrder ->
                if (targetOrder != null) {
                    OrderDetailScreen(
                        order = targetOrder,
                        onBack = { selectedOrder = null },
                        onStatusChange = { order, newStatus ->
                            val idx = orders.indexOfFirst { it.id == order.id }
                            if (idx >= 0) {
                                orders[idx] = orders[idx].copy(status = newStatus)
                                selectedOrder = orders[idx]
                                scope.launch { updateOrderStatus(order.id, newStatus) }
                            }
                        },
                        onDelete = { order ->
                            orders.removeAll { it.id == order.id }
                            selectedOrder = null
                            scope.launch { deleteOrderBackend(order.id) }
                        },
                        onPushToBigShip = { order ->
                            scope.launch {
                                try {
                                    Toast.makeText(context, "Pushing order #${order.id.takeLast(4)} to Big Ship...", Toast.LENGTH_SHORT).show()
                                    val res = pushSingleOrderBackend(order.id)
                                    val awbMsg = res.awb?.takeIf { it.isNotBlank() } ?: res.shipment_id ?: "Booked"
                                    Toast.makeText(context, res.message ?: "Booked on BigShip: $awbMsg", Toast.LENGTH_LONG).show()
                                    val updatedAwb = res.awb ?: "Assigned on Dispatch"
                                    val idx = orders.indexOfFirst { it.id == order.id }
                                    if (idx >= 0) {
                                        orders[idx] = orders[idx].copy(bigshipAwb = updatedAwb, status = "Shipped")
                                        selectedOrder = orders[idx]
                                    }
                                    refreshTrigger++
                                } catch (e: Exception) {
                                    Toast.makeText(context, "BigShip Error: ${e.message}", Toast.LENGTH_LONG).show()
                                }
                            }
                        },
                        colors = colors
                    )
                } else {
                    when (currentTab) {
                        "Dashboard" -> DashboardScreen(colors = colors, orders = orders)
                        "Orders" -> OrdersTableScreen(
                            orders = orders,
                            onOrderClick = { selectedOrder = it },
                            onRefresh = { refreshTrigger++ },
                            onStatusChange = { order, newStatus ->
                                val idx = orders.indexOfFirst { it.id == order.id }
                                if (idx >= 0) {
                                    orders[idx] = orders[idx].copy(status = newStatus)
                                    scope.launch { updateOrderStatus(order.id, newStatus) }
                                }
                            },
                            onDeleteOrders = { idsToDelete ->
                                orders.removeAll { it.id in idsToDelete }
                                scope.launch { deleteMultipleOrdersBackend(idsToDelete) }
                            },
                            onDeleteAllOrders = {
                                orders.clear()
                                scope.launch { deleteAllOrdersBackend() }
                            },
                            onPushSelectedToBigShip = { idsToPush ->
                                scope.launch {
                                    try {
                                        Toast.makeText(context, "Pushing ${idsToPush.size} orders to Big Ship...", Toast.LENGTH_SHORT).show()
                                        val res = pushSelectedOrdersBackend(idsToPush)
                                        Toast.makeText(context, res.message ?: "Selected orders pushed successfully!", Toast.LENGTH_LONG).show()
                                        refreshTrigger++
                                    } catch (e: Exception) {
                                        Toast.makeText(context, "BigShip Error: ${e.message}", Toast.LENGTH_LONG).show()
                                    }
                                }
                            },
                            onPushAllUnbookedToBigShip = {
                                scope.launch {
                                    try {
                                        Toast.makeText(context, "Pushing all unbooked orders to Big Ship...", Toast.LENGTH_SHORT).show()
                                        val res = pushAllUnbookedOrdersBackend()
                                        Toast.makeText(context, res.message ?: "All unbooked orders processed!", Toast.LENGTH_LONG).show()
                                        refreshTrigger++
                                    } catch (e: Exception) {
                                        Toast.makeText(context, "BigShip Error: ${e.message}", Toast.LENGTH_LONG).show()
                                    }
                                }
                            },
                            colors = colors
                        )
                        "Bulk" -> BulkOrdersScreen(colors = colors)
                        "Settings" -> SettingsScreen(
                            isDarkTheme = isDarkTheme,
                            onThemeToggle = onThemeToggle,
                            colors = colors
                        )
                    }
                }
            }
        }
    }
}

// ──────────────────── DASHBOARD ────────────────────
@Composable
fun DashboardScreen(colors: AppColors, orders: List<Order>) {
    var selectedTimeRange by remember { mutableStateOf("All Time") }
    val timeRanges = listOf("This Week", "This Month", "All Time")
    var isDropdownExpanded by remember { mutableStateOf(false) }

    val filteredOrders = remember(orders, selectedTimeRange) {
        val now = System.currentTimeMillis()
        val oneWeek = 7L * 24 * 60 * 60 * 1000
        val oneMonth = 30L * 24 * 60 * 60 * 1000
        orders.filter { order ->
            when (selectedTimeRange) {
                "This Week" -> (now - order.createdAt) <= oneWeek
                "This Month" -> (now - order.createdAt) <= oneMonth
                else -> true
            }
        }
    }

    val totalSales = filteredOrders.sumOf { it.amount }
    val totalOrders = filteredOrders.size

    val productSales = remember(filteredOrders) {
        val salesMap = mutableMapOf<String, Double>()
        filteredOrders.forEach { order ->
            try {
                val itemsArr = JSONArray(order.rawItems)
                for (i in 0 until itemsArr.length()) {
                    val item = itemsArr.getJSONObject(i)
                    val name = item.getString("name")
                    val price = item.getDouble("price")
                    val qty = item.getInt("quantity")
                    salesMap[name] = (salesMap[name] ?: 0.0) + (price * qty)
                }
            } catch (e: Exception) {
                // Ignore parsing errors for fallback formats
            }
        }
        val colorsPool = listOf(Color(0xFF00E5FF), Color(0xFFFF6B6B), Color(0xFFFFC107), Color(0xFF4CAF50), Color(0xFFAB47BC))
        salesMap.entries.mapIndexed { index, entry ->
            ProductSale(entry.key, entry.value, colorsPool[index % colorsPool.size])
        }.sortedByDescending { it.amount }
    }

    val pageVisits = remember {
        listOf(
            PageVisit("Home", 1247, Color(0xFF00E5FF)),
            PageVisit("Pillows", 893, Color(0xFFFF6B6B)),
            PageVisit("Cushions", 641, Color(0xFFFFC107)),
            PageVisit("Product", 512, Color(0xFF4CAF50)),
            PageVisit("About", 284, Color(0xFFAB47BC)),
            PageVisit("Checkout", 156, Color(0xFF42A5F5))
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(top = 48.dp, start = 16.dp, end = 16.dp, bottom = 16.dp)
    ) {
        Text(
            text = "Dashboard",
            fontSize = 32.sp,
            fontWeight = FontWeight.ExtraBold,
            color = colors.textPrimary,
            modifier = Modifier.padding(bottom = 24.dp)
        )

        // ── Overview Cards Row ──
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCard(
                title = "Total Sales",
                value = "Rs. ${String.format("%,.0f", totalSales)}",
                icon = Icons.Filled.ShoppingCart,
                colors = colors,
                modifier = Modifier.weight(1f)
            )
            StatCard(
                title = "Orders",
                value = "$totalOrders",
                icon = Icons.Filled.CheckCircle,
                colors = colors,
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // ── Sales by Product ──
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Sales by Product",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = colors.textPrimary
            )
            
            Box {
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(colors.accent.copy(alpha = 0.1f))
                        .clickable { isDropdownExpanded = true }
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(selectedTimeRange, fontSize = 12.sp, color = colors.accent, fontWeight = FontWeight.Bold)
                    Icon(Icons.Filled.ArrowDropDown, contentDescription = null, tint = colors.accent, modifier = Modifier.size(16.dp))
                }
                DropdownMenu(
                    expanded = isDropdownExpanded,
                    onDismissRequest = { isDropdownExpanded = false }
                ) {
                    timeRanges.forEach { range ->
                        DropdownMenuItem(
                            text = { Text(range, color = colors.textPrimary) },
                            onClick = {
                                selectedTimeRange = range
                                isDropdownExpanded = false
                            }
                        )
                    }
                }
            }
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(colors.cardBg)
                .padding(20.dp)
        ) {
            HorizontalBarChart(data = productSales, colors = colors)
        }

        Spacer(modifier = Modifier.height(24.dp))

        // ── Page Traffic ──
        Text(
            text = "Page Traffic",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = colors.textPrimary,
            modifier = Modifier.padding(bottom = 12.dp)
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(colors.cardBg)
                .padding(20.dp)
        ) {
            VerticalBarChart(data = pageVisits, colors = colors)
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}

@Composable
fun StatCard(
    title: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    colors: AppColors,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(20.dp))
            .background(
                Brush.linearGradient(
                    listOf(colors.accent.copy(alpha = 0.15f), colors.accent.copy(alpha = 0.05f))
                )
            )
            .padding(20.dp)
    ) {
        Column {
            Icon(
                icon,
                contentDescription = null,
                tint = colors.accent,
                modifier = Modifier.size(28.dp)
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(title, color = colors.textSecondary, fontSize = 13.sp)
            Spacer(modifier = Modifier.height(4.dp))
            Text(value, color = colors.textPrimary, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
        }
    }
}

@Composable
fun HorizontalBarChart(data: List<ProductSale>, colors: AppColors) {
    if (data.isEmpty()) return
    val maxVal = data.maxOf { it.amount }.takeIf { it > 0 } ?: 1.0
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        data.forEach { item ->
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(item.name, color = colors.textPrimary, fontSize = 14.sp)
                    Text("Rs. ${String.format("%,.0f", item.amount)}", color = colors.textSecondary, fontSize = 13.sp)
                }
                Spacer(modifier = Modifier.height(6.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(10.dp)
                        .clip(RoundedCornerShape(5.dp))
                        .background(colors.divider)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(fraction = (item.amount / maxVal).toFloat())
                            .height(10.dp)
                            .clip(RoundedCornerShape(5.dp))
                            .background(
                                Brush.horizontalGradient(
                                    listOf(item.color, item.color.copy(alpha = 0.5f))
                                )
                            )
                    )
                }
            }
        }
    }
}

@Composable
fun VerticalBarChart(data: List<PageVisit>, colors: AppColors) {
    val maxVisits = data.maxOf { it.visits }
    val chartHeight = 160.dp

    Column {
        // Bars
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(chartHeight),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.Bottom
        ) {
            val safeMaxVisits = maxVisits.takeIf { it > 0 } ?: 1
            data.forEach { page ->
                val fraction = page.visits.toFloat() / safeMaxVisits.toFloat()
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Bottom,
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        "${page.visits}",
                        color = colors.textSecondary,
                        fontSize = 10.sp,
                        modifier = Modifier.padding(bottom = 4.dp)
                    )
                    Box(
                        modifier = Modifier
                            .width(28.dp)
                            .fillMaxHeight(fraction = fraction)
                            .clip(RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp))
                            .background(
                                Brush.verticalGradient(
                                    listOf(page.color, page.color.copy(alpha = 0.4f))
                                )
                            )
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))
        HorizontalDivider(color = colors.divider, thickness = 1.dp)
        Spacer(modifier = Modifier.height(8.dp))

        // Labels
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            data.forEach { page ->
                Text(
                    page.pageName,
                    color = colors.textSecondary,
                    fontSize = 10.sp,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

// ──────────────────── ORDERS ────────────────────
@Composable
fun OrdersTableScreen(
    orders: List<Order>,
    onOrderClick: (Order) -> Unit,
    onRefresh: () -> Unit,
    onStatusChange: (Order, String) -> Unit,
    onDeleteOrders: (List<String>) -> Unit,
    onDeleteAllOrders: () -> Unit,
    onPushSelectedToBigShip: (List<String>) -> Unit,
    onPushAllUnbookedToBigShip: () -> Unit,
    colors: AppColors
) {
    var isLoading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableIntStateOf(0) }

    var isSelectionMode by remember { mutableStateOf(false) }
    val selectedIds = remember { mutableStateListOf<String>() }
    var showDeleteSelectedDialog by remember { mutableStateOf(false) }
    var showDeleteAllDialog by remember { mutableStateOf(false) }
    var showPushSelectedDialog by remember { mutableStateOf(false) }
    var showPushAllDialog by remember { mutableStateOf(false) }

    LaunchedEffect(refreshKey) {
        if (refreshKey > 0) {
            isLoading = true
            error = null
            onRefresh()
            kotlinx.coroutines.delay(500) // Brief refresh animation
            isLoading = false
        }
    }

    // Confirmation Dialog: Delete Selected
    if (showDeleteSelectedDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteSelectedDialog = false },
            title = {
                Text(
                    text = "Delete Selected Orders",
                    fontWeight = FontWeight.Bold,
                    color = colors.textPrimary
                )
            },
            text = {
                Text(
                    text = "Are you sure you want to delete ${selectedIds.size} selected order(s)? This action cannot be undone.",
                    color = colors.textSecondary
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val ids = selectedIds.toList()
                        showDeleteSelectedDialog = false
                        isSelectionMode = false
                        selectedIds.clear()
                        onDeleteOrders(ids)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE53935))
                ) {
                    Text("Delete (${selectedIds.size})", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteSelectedDialog = false }) {
                    Text("Cancel", color = colors.textPrimary)
                }
            },
            containerColor = colors.cardBg
        )
    }

    // Confirmation Dialog: Delete All
    if (showDeleteAllDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteAllDialog = false },
            title = {
                Text(
                    text = "Delete All Orders",
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFE53935)
                )
            },
            text = {
                Text(
                    text = "Are you sure you want to permanently delete ALL ${orders.size} orders? This action cannot be undone.",
                    color = colors.textSecondary
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showDeleteAllDialog = false
                        isSelectionMode = false
                        selectedIds.clear()
                        onDeleteAllOrders()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE53935))
                ) {
                    Text("Delete All", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteAllDialog = false }) {
                    Text("Cancel", color = colors.textPrimary)
                }
            },
            containerColor = colors.cardBg
        )
    }

    // Confirmation Dialog: Push Selected to Big Ship
    if (showPushSelectedDialog) {
        AlertDialog(
            onDismissRequest = { showPushSelectedDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.LocalShipping, contentDescription = null, tint = Color(0xFF673AB7))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Push Selected to Big Ship",
                        fontWeight = FontWeight.Bold,
                        color = colors.textPrimary
                    )
                }
            },
            text = {
                Text(
                    text = "Push ${selectedIds.size} selected order(s) to Big Ship Direct for automated shipment booking?",
                    color = colors.textSecondary
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val ids = selectedIds.toList()
                        showPushSelectedDialog = false
                        isSelectionMode = false
                        selectedIds.clear()
                        onPushSelectedToBigShip(ids)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF673AB7))
                ) {
                    Icon(Icons.Filled.LocalShipping, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Push (${selectedIds.size})", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showPushSelectedDialog = false }) {
                    Text("Cancel", color = colors.textPrimary)
                }
            },
            containerColor = colors.cardBg
        )
    }

    // Confirmation Dialog: Push All Unbooked
    if (showPushAllDialog) {
        AlertDialog(
            onDismissRequest = { showPushAllDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.LocalShipping, contentDescription = null, tint = Color(0xFF673AB7))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Push All Unbooked",
                        fontWeight = FontWeight.Bold,
                        color = colors.textPrimary
                    )
                }
            },
            text = {
                Text(
                    text = "This will find all unbooked orders and push them to Big Ship Direct. Continue?",
                    color = colors.textSecondary
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showPushAllDialog = false
                        onPushAllUnbookedToBigShip()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF673AB7))
                ) {
                    Icon(Icons.Filled.LocalShipping, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Push All Unbooked", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showPushAllDialog = false }) {
                    Text("Cancel", color = colors.textPrimary)
                }
            },
            containerColor = colors.cardBg
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(top = 48.dp, start = 16.dp, end = 16.dp)
    ) {
        // Title & Actions Bar
        if (isSelectionMode) {
            // Selection Mode Header Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 20.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(
                        onClick = {
                            isSelectionMode = false
                            selectedIds.clear()
                        },
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            Icons.Filled.Close,
                            contentDescription = "Cancel Selection",
                            tint = colors.textPrimary
                        )
                    }
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "${selectedIds.size} selected",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = colors.textPrimary
                    )
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Select All / Deselect Toggle
                    val isAllSelected = orders.isNotEmpty() && selectedIds.size == orders.size
                    OutlinedButton(
                        onClick = {
                            if (isAllSelected) {
                                selectedIds.clear()
                            } else {
                                selectedIds.clear()
                                selectedIds.addAll(orders.map { it.id })
                            }
                        },
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = if (isAllSelected) "Deselect" else "Select All",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = colors.accent
                        )
                    }

                    // Push Selected to Big Ship Icon
                    IconButton(
                        onClick = {
                            if (selectedIds.isNotEmpty()) {
                                showPushSelectedDialog = true
                            }
                        },
                        enabled = selectedIds.isNotEmpty(),
                        modifier = Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(
                                if (selectedIds.isNotEmpty()) Color(0xFF673AB7).copy(alpha = 0.18f)
                                else Color.Transparent
                            )
                    ) {
                        Icon(
                            Icons.Filled.LocalShipping,
                            contentDescription = "Push Selected to Big Ship",
                            tint = if (selectedIds.isNotEmpty()) Color(0xFF673AB7) else colors.textSecondary.copy(alpha = 0.4f)
                        )
                    }

                    // Delete Selected Icon
                    IconButton(
                        onClick = {
                            if (selectedIds.isNotEmpty()) {
                                showDeleteSelectedDialog = true
                            }
                        },
                        enabled = selectedIds.isNotEmpty(),
                        modifier = Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(
                                if (selectedIds.isNotEmpty()) Color(0xFFE53935).copy(alpha = 0.15f)
                                else Color.Transparent
                            )
                    ) {
                        Icon(
                            Icons.Filled.Delete,
                            contentDescription = "Delete Selected",
                            tint = if (selectedIds.isNotEmpty()) Color(0xFFE53935) else colors.textSecondary.copy(alpha = 0.4f)
                        )
                    }

                    // Delete All Icon
                    IconButton(
                        onClick = {
                            if (orders.isNotEmpty()) {
                                showDeleteAllDialog = true
                            }
                        },
                        enabled = orders.isNotEmpty(),
                        modifier = Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(
                                if (orders.isNotEmpty()) Color(0xFFE53935).copy(alpha = 0.15f)
                                else Color.Transparent
                            )
                    ) {
                        Icon(
                            Icons.Filled.DeleteSweep,
                            contentDescription = "Delete All",
                            tint = if (orders.isNotEmpty()) Color(0xFFE53935) else colors.textSecondary.copy(alpha = 0.4f)
                        )
                    }
                }
            }
        } else {
            // Normal Header Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 24.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Live Orders",
                    fontSize = 32.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = colors.textPrimary
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Push All Unbooked Button
                    OutlinedButton(
                        onClick = { showPushAllDialog = true },
                        enabled = orders.isNotEmpty(),
                        shape = RoundedCornerShape(12.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp)
                    ) {
                        Icon(
                            Icons.Filled.LocalShipping,
                            contentDescription = null,
                            tint = Color(0xFF673AB7),
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Push All",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF673AB7)
                        )
                    }

                    // Select Mode Toggle Button
                    OutlinedButton(
                        onClick = {
                            isSelectionMode = true
                            selectedIds.clear()
                        },
                        enabled = orders.isNotEmpty(),
                        shape = RoundedCornerShape(12.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        Icon(
                            Icons.Filled.CheckCircle,
                            contentDescription = null,
                            tint = colors.accent,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Select",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = colors.accent
                        )
                    }

                    // Delete All Orders Button
                    IconButton(
                        onClick = {
                            if (orders.isNotEmpty()) {
                                showDeleteAllDialog = true
                            }
                        },
                        enabled = orders.isNotEmpty(),
                        modifier = Modifier
                            .size(44.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(
                                if (orders.isNotEmpty()) Color(0xFFE53935).copy(alpha = 0.12f)
                                else Color.Transparent
                            )
                    ) {
                        Icon(
                            Icons.Filled.DeleteSweep,
                            contentDescription = "Delete All Orders",
                            tint = if (orders.isNotEmpty()) Color(0xFFE53935) else colors.textSecondary.copy(alpha = 0.4f)
                        )
                    }

                    // Refresh Button
                    IconButton(
                        onClick = { refreshKey++ },
                        modifier = Modifier
                            .size(44.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(colors.accent.copy(alpha = 0.15f))
                    ) {
                        Icon(
                            Icons.Filled.Refresh,
                            contentDescription = "Refresh",
                            tint = colors.accent
                        )
                    }
                }
            }
        }

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = colors.accent)
            }
        } else if (error != null) {
            Text("Error: $error", color = Color.Red)
        } else if (orders.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Filled.ShoppingCart,
                        contentDescription = null,
                        tint = colors.textSecondary.copy(alpha = 0.4f),
                        modifier = Modifier.size(64.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "No orders found",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = colors.textSecondary
                    )
                }
            }
        } else {
            // Table Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp))
                    .background(colors.tableHeader)
                    .padding(horizontal = 12.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (isSelectionMode) {
                    val isAllSelected = orders.isNotEmpty() && selectedIds.size == orders.size
                    Checkbox(
                        checked = isAllSelected,
                        onCheckedChange = { checked ->
                            if (checked) {
                                selectedIds.clear()
                                selectedIds.addAll(orders.map { it.id })
                            } else {
                                selectedIds.clear()
                            }
                        },
                        colors = CheckboxDefaults.colors(
                            checkedColor = colors.accent,
                            uncheckedColor = colors.textSecondary
                        ),
                        modifier = Modifier
                            .size(28.dp)
                            .padding(end = 6.dp)
                    )
                }
                Text("ID", color = colors.textPrimary, fontWeight = FontWeight.Bold, modifier = Modifier.weight(0.18f), maxLines = 1)
                Text("Customer", color = colors.textPrimary, fontWeight = FontWeight.Bold, modifier = Modifier.weight(0.32f), maxLines = 1)
                Text("Total", color = colors.textPrimary, fontWeight = FontWeight.Bold, modifier = Modifier.weight(0.25f), maxLines = 1)
                Text("Status", color = colors.textPrimary, fontWeight = FontWeight.Bold, modifier = Modifier.weight(0.25f), maxLines = 1)
            }

            // Table Body
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(bottomStart = 12.dp, bottomEnd = 12.dp))
                    .background(colors.cardBg)
            ) {
                items(orders.withIndex().toList(), key = { it.value.id }) { (index, order) ->
                    val isSelected = isSelectionMode && order.id in selectedIds
                    val rowBg = if (isSelected) {
                        colors.accent.copy(alpha = 0.12f)
                    } else if (index % 2 == 0) {
                        Color.Transparent
                    } else {
                        colors.divider
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(rowBg)
                            .clickable {
                                if (isSelectionMode) {
                                    if (order.id in selectedIds) {
                                        selectedIds.remove(order.id)
                                    } else {
                                        selectedIds.add(order.id)
                                    }
                                } else {
                                    onOrderClick(order)
                                }
                            }
                            .padding(horizontal = 12.dp, vertical = 14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (isSelectionMode) {
                            Checkbox(
                                checked = order.id in selectedIds,
                                onCheckedChange = { checked ->
                                    if (checked) {
                                        if (order.id !in selectedIds) selectedIds.add(order.id)
                                    } else {
                                        selectedIds.remove(order.id)
                                    }
                                },
                                colors = CheckboxDefaults.colors(
                                    checkedColor = colors.accent,
                                    uncheckedColor = colors.textSecondary
                                ),
                                modifier = Modifier
                                    .size(28.dp)
                                    .padding(end = 6.dp)
                            )
                        }

                        Row(
                            modifier = Modifier.weight(0.18f),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "#" + order.id.takeLast(4),
                                color = colors.textSecondary,
                                maxLines = 1
                            )
                            if (order.bigshipAwb.isNotBlank() && order.bigshipAwb != "N/A" && order.bigshipAwb != "Pending") {
                                Spacer(modifier = Modifier.width(4.dp))
                                Icon(
                                    Icons.Filled.LocalShipping,
                                    contentDescription = "Booked",
                                    tint = Color(0xFF4CAF50),
                                    modifier = Modifier.size(12.dp)
                                )
                            }
                        }
                        Text(
                            text = order.customerName,
                            color = colors.textPrimary,
                            modifier = Modifier.weight(0.32f),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = "Rs. ${order.amount}",
                            color = colors.accent,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.weight(0.25f),
                            maxLines = 1
                        )

                        // Status dropdown
                        val statusColor = when (order.status) {
                            "Placed" -> Color(0xFFFFC107)
                            "Shipped" -> Color(0xFF42A5F5)
                            "Delivered" -> Color(0xFF4CAF50)
                            else -> colors.textSecondary
                        }
                        val statusBg = statusColor.copy(alpha = 0.15f)
                        var expanded by remember { mutableStateOf(false) }
                        val statuses = listOf("Placed", "Shipped", "Delivered")

                        Box(modifier = Modifier.weight(0.25f)) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(statusBg)
                                    .clickable { if (!isSelectionMode) expanded = true }
                                    .padding(horizontal = 6.dp, vertical = 4.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        order.status,
                                        color = statusColor,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        maxLines = 1
                                    )
                                    Icon(
                                        Icons.Filled.ArrowDropDown,
                                        contentDescription = null,
                                        tint = statusColor,
                                        modifier = Modifier.size(14.dp)
                                    )
                                }
                            }
                            DropdownMenu(
                                expanded = expanded,
                                onDismissRequest = { expanded = false }
                            ) {
                                statuses.forEach { status ->
                                    DropdownMenuItem(
                                        text = { Text(status) },
                                        onClick = {
                                            onStatusChange(order, status)
                                            expanded = false
                                        }
                                    )
                                }
                            }
                        }
                    }
                    HorizontalDivider(color = colors.divider, thickness = 1.dp)
                }
            }
        }
    }
}

// ──────────────────── ORDER DETAIL ────────────────────
@Composable
fun OrderDetailScreen(
    order: Order,
    onBack: () -> Unit,
    onStatusChange: (Order, String) -> Unit,
    onDelete: (Order) -> Unit,
    onPushToBigShip: (Order) -> Unit,
    colors: AppColors
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background)
            .verticalScroll(rememberScrollState())
            .padding(top = 48.dp, start = 20.dp, end = 20.dp)
    ) {
        // Top Bar
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(bottom = 24.dp)
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.Filled.ArrowBack, contentDescription = "Back", tint = colors.textPrimary)
            }
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Order Details",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = colors.textPrimary
            )
        }

        // Status Card
        val statusColor = when (order.status) {
            "Placed" -> Color(0xFFFFC107)
            "Shipped" -> Color(0xFF42A5F5)
            "Delivered" -> Color(0xFF4CAF50)
            else -> colors.textSecondary
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(statusColor.copy(alpha = 0.1f))
                .padding(20.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(14.dp)
                            .clip(RoundedCornerShape(7.dp))
                            .background(statusColor)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text("Current Status", color = colors.textSecondary, fontSize = 12.sp)
                        Text(order.status, color = statusColor, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Action Buttons
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            when (order.status) {
                "Placed" -> {
                    Button(
                        onClick = { onStatusChange(order, "Shipped") },
                        modifier = Modifier.weight(1f).height(48.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF42A5F5)
                        )
                    ) {
                        Icon(Icons.Filled.Send, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Mark Shipped", fontWeight = FontWeight.Bold)
                    }
                }
                "Shipped" -> {
                    Button(
                        onClick = { onStatusChange(order, "Delivered") },
                        modifier = Modifier.weight(1f).height(48.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF4CAF50)
                        )
                    ) {
                        Icon(Icons.Filled.CheckCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Mark Delivered", fontWeight = FontWeight.Bold)
                    }
                }
                "Delivered" -> {
                    Button(
                        onClick = { onDelete(order) },
                        modifier = Modifier.weight(1f).height(48.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFEF5350)
                        )
                    ) {
                        Icon(Icons.Filled.Delete, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Delete Order", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Big Ship Direct Integration Card
        val isBookedOnBigShip = order.bigshipAwb.isNotBlank() && order.bigshipAwb != "N/A" && order.bigshipAwb != "Pending"
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color(0xFF673AB7).copy(alpha = 0.12f))
                .padding(18.dp)
        ) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Filled.LocalShipping,
                            contentDescription = null,
                            tint = Color(0xFF673AB7),
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                "Big Ship Direct",
                                color = colors.textPrimary,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                if (isBookedOnBigShip) "Booked • AWB: ${order.bigshipAwb}" else "Shipment not booked yet",
                                color = if (isBookedOnBigShip) Color(0xFF4CAF50) else colors.textSecondary,
                                fontSize = 12.sp,
                                fontWeight = if (isBookedOnBigShip) FontWeight.SemiBold else FontWeight.Normal
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                Button(
                    onClick = { onPushToBigShip(order) },
                    modifier = Modifier.fillMaxWidth().height(46.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF673AB7)
                    )
                ) {
                    Icon(
                        Icons.Filled.CloudUpload,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        if (isBookedOnBigShip) "Re-push to Big Ship" else "Push to Big Ship",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Glass Morphism Info Card
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(Brush.linearGradient(listOf(colors.cardBg, colors.cardBg.copy(alpha = 0.05f))))
                .padding(24.dp)
        ) {
            Column {
                Text("Order ID", color = colors.textSecondary, fontSize = 14.sp)
                Text(order.id, color = colors.textPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)

                Spacer(modifier = Modifier.height(24.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Person, contentDescription = null, tint = colors.accent, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text("Customer", color = colors.textSecondary, fontSize = 12.sp)
                        Text(order.customerName, color = colors.textPrimary, fontSize = 16.sp)
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Phone, contentDescription = null, tint = colors.accent, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text("Contact", color = colors.textSecondary, fontSize = 12.sp)
                        Text(order.phone, color = colors.textPrimary, fontSize = 16.sp)
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Place, contentDescription = null, tint = colors.accent, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text("Shipping Address", color = colors.textSecondary, fontSize = 12.sp)
                        Text(order.address, color = colors.textPrimary, fontSize = 16.sp)
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Info, contentDescription = null, tint = colors.accent, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text("Payment", color = colors.textSecondary, fontSize = 12.sp)
                        Text("${order.paymentMethod} • ID: ${order.paymentId}", color = colors.textPrimary, fontSize = 16.sp)
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Send, contentDescription = null, tint = colors.accent, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text("Big Ship AWB", color = colors.textSecondary, fontSize = 12.sp)
                        val displayAwb = if (order.bigshipAwb != "N/A") order.bigshipAwb else order.shiprocketAwb
                        Text(displayAwb, color = colors.textPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Items Card
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(colors.cardBg)
                .padding(24.dp)
        ) {
            Column {
                Text("Order Summary", color = colors.accent, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Spacer(modifier = Modifier.height(16.dp))
                Text(order.items, color = colors.textPrimary, fontSize = 16.sp, lineHeight = 24.sp)

                Spacer(modifier = Modifier.height(16.dp))
                HorizontalDivider(color = colors.divider)
                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Total Amount", color = colors.textSecondary, fontSize = 16.sp)
                    Text("Rs. ${order.amount}", color = colors.accent, fontWeight = FontWeight.ExtraBold, fontSize = 22.sp)
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}

// ──────────────────── SETTINGS ────────────────────
@Composable
fun SettingsScreen(isDarkTheme: Boolean, onThemeToggle: () -> Unit, colors: AppColors) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(top = 48.dp, start = 16.dp, end = 16.dp)
    ) {
        Text(
            text = "Settings",
            fontSize = 32.sp,
            fontWeight = FontWeight.ExtraBold,
            color = colors.textPrimary,
            modifier = Modifier.padding(bottom = 24.dp)
        )

        // Theme Toggle Card
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(colors.cardBg)
                .padding(20.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        if (isDarkTheme) Icons.Filled.Star else Icons.Filled.Star,
                        contentDescription = null,
                        tint = colors.accent,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(16.dp))
                    Column {
                        Text("Dark Theme", color = colors.textPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                        Text(
                            if (isDarkTheme) "Currently using dark mode" else "Currently using light mode",
                            color = colors.textSecondary,
                            fontSize = 13.sp
                        )
                    }
                }
                Switch(
                    checked = isDarkTheme,
                    onCheckedChange = { onThemeToggle() },
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = colors.accent,
                        checkedTrackColor = colors.accent.copy(alpha = 0.3f),
                        uncheckedThumbColor = colors.textSecondary,
                        uncheckedTrackColor = colors.divider
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // App Info
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(colors.cardBg)
                .padding(20.dp)
        ) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Info, contentDescription = null, tint = colors.accent, modifier = Modifier.size(24.dp))
                    Spacer(modifier = Modifier.width(16.dp))
                    Column {
                        Text("RestNest Admin", color = colors.textPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                        Text("Version 2.0", color = colors.textSecondary, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

// ──────────────────── Data ────────────────────


suspend fun updateOrderStatus(id: String, status: String) = withContext(Dispatchers.IO) {
    try {
        val db = FirebaseFirestore.getInstance()
        db.collection("orders").whereEqualTo("id", id).get().addOnSuccessListener { querySnapshot ->
            if (!querySnapshot.isEmpty) {
                val docId = querySnapshot.documents[0].id
                db.collection("orders").document(docId).update("status", status)
            }
        }
    } catch (e: Exception) {
        e.printStackTrace()
    }
}

suspend fun deleteOrderBackend(id: String) = withContext(Dispatchers.IO) {
    try {
        try {
            RetrofitClient.instance.deleteOrder(id)
        } catch (e: Exception) {
            e.printStackTrace()
        }
        val db = FirebaseFirestore.getInstance()
        db.collection("orders").whereEqualTo("id", id).get().addOnSuccessListener { querySnapshot ->
            if (!querySnapshot.isEmpty) {
                val docId = querySnapshot.documents[0].id
                db.collection("orders").document(docId).delete()
            }
        }
    } catch (e: Exception) {
        e.printStackTrace()
    }
}

suspend fun deleteMultipleOrdersBackend(ids: List<String>) = withContext(Dispatchers.IO) {
    if (ids.isEmpty()) return@withContext
    try {
        try {
            RetrofitClient.instance.deleteMultipleOrders(com.example.restnestadmin.api.DeleteOrdersRequest(ids))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        val db = FirebaseFirestore.getInstance()
        ids.forEach { id ->
            db.collection("orders").whereEqualTo("id", id).get().addOnSuccessListener { querySnapshot ->
                if (!querySnapshot.isEmpty) {
                    val docId = querySnapshot.documents[0].id
                    db.collection("orders").document(docId).delete()
                }
            }
        }
    } catch (e: Exception) {
        e.printStackTrace()
    }
}

suspend fun deleteAllOrdersBackend() = withContext(Dispatchers.IO) {
    try {
        try {
            RetrofitClient.instance.resetAllOrders()
        } catch (e: Exception) {
            e.printStackTrace()
        }
        val db = FirebaseFirestore.getInstance()
        db.collection("orders").get().addOnSuccessListener { querySnapshot ->
            for (doc in querySnapshot.documents) {
                doc.reference.delete()
            }
        }
    } catch (e: Exception) {
        e.printStackTrace()
    }
}

suspend fun pushSingleOrderBackend(orderId: String): com.example.restnestadmin.api.BigShipPushResponse = withContext(Dispatchers.IO) {
    RetrofitClient.instance.pushSingleOrderToBigShip(com.example.restnestadmin.api.PushSingleOrderRequest(orderId))
}

suspend fun pushSelectedOrdersBackend(ids: List<String>): com.example.restnestadmin.api.BigShipPushResponse = withContext(Dispatchers.IO) {
    RetrofitClient.instance.pushSelectedOrdersToBigShip(com.example.restnestadmin.api.PushSelectedOrdersRequest(ids))
}

suspend fun pushAllUnbookedOrdersBackend(): com.example.restnestadmin.api.BigShipPushResponse = withContext(Dispatchers.IO) {
    RetrofitClient.instance.pushAllUnbookedOrdersToBigShip()
}


// ──────────────────── BULK ORDERS ────────────────────
@Composable
fun BulkOrdersScreen(colors: AppColors) {
    var bulkOrders by remember { mutableStateOf<List<BulkOrder>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var isRefreshing by remember { mutableStateOf(false) }
    var selectedFilter by remember { mutableStateOf("All") }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    suspend fun fetchOrders(showSpinner: Boolean = false) {
        if (showSpinner) isRefreshing = true
        try {
            val response = RetrofitClient.instance.getBulkOrders()
            if (response.success && response.bulkOrders != null) {
                bulkOrders = response.bulkOrders
                errorMessage = null
            } else {
                if (bulkOrders.isEmpty()) {
                    errorMessage = "Failed to load bulk requests."
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            if (bulkOrders.isEmpty()) {
                errorMessage = "Network error: ${e.localizedMessage ?: "Unable to connect"}"
            }
        } finally {
            isLoading = false
            isRefreshing = false
        }
    }

    LaunchedEffect(Unit) {
        while (true) {
            fetchOrders(showSpinner = false)
            delay(10000)
        }
    }

    val filteredOrders = remember(bulkOrders, selectedFilter) {
        when (selectedFilter) {
            "Pending" -> bulkOrders.filter { it.status.equals("Pending", ignoreCase = true) }
            "Contacted" -> bulkOrders.filter { it.status.equals("Contacted", ignoreCase = true) }
            "Completed" -> bulkOrders.filter { it.status.equals("Completed", ignoreCase = true) }
            else -> bulkOrders
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(top = 48.dp, start = 16.dp, end = 16.dp)
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Bulk Requests",
                    fontSize = 28.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = colors.textPrimary
                )
                Text(
                    text = "${bulkOrders.size} total inquiries",
                    fontSize = 13.sp,
                    color = colors.textSecondary
                )
            }

            IconButton(
                onClick = {
                    coroutineScope.launch {
                        fetchOrders(showSpinner = true)
                        Toast.makeText(context, "Refreshed bulk orders", Toast.LENGTH_SHORT).show()
                    }
                },
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(colors.cardBg)
            ) {
                if (isRefreshing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp,
                        color = colors.accent
                    )
                } else {
                    Icon(
                        Icons.Filled.Refresh,
                        contentDescription = "Refresh",
                        tint = colors.accent
                    )
                }
            }
        }

        // Filter Pills
        val filterOptions = listOf("All", "Pending", "Contacted", "Completed")
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            filterOptions.forEach { filter ->
                val isSelected = selectedFilter == filter
                val count = when (filter) {
                    "Pending" -> bulkOrders.count { it.status.equals("Pending", ignoreCase = true) }
                    "Contacted" -> bulkOrders.count { it.status.equals("Contacted", ignoreCase = true) }
                    "Completed" -> bulkOrders.count { it.status.equals("Completed", ignoreCase = true) }
                    else -> bulkOrders.size
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .background(if (isSelected) colors.accent else colors.cardBg)
                        .clickable { selectedFilter = filter }
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = "$filter ($count)",
                        fontSize = 12.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                        color = if (isSelected) Color.White else colors.textSecondary
                    )
                }
            }
        }

        // Content
        if (isLoading && bulkOrders.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = colors.accent)
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        "Loading bulk requests...",
                        color = colors.textSecondary,
                        fontSize = 14.sp
                    )
                }
            }
        } else if (filteredOrders.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(bottom = 64.dp)
                ) {
                    Icon(
                        Icons.Filled.ShoppingCart,
                        contentDescription = null,
                        modifier = Modifier.size(56.dp),
                        tint = colors.textSecondary.copy(alpha = 0.5f)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = if (errorMessage != null) errorMessage!! else "No bulk requests found",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = colors.textPrimary
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Customer requests from restnest.in/bulk will appear here.",
                        fontSize = 13.sp,
                        color = colors.textSecondary
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = {
                            coroutineScope.launch { fetchOrders(showSpinner = true) }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = colors.accent)
                    ) {
                        Text("Retry Refresh", color = Color.White)
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 96.dp)
            ) {
                items(filteredOrders, key = { it.id.ifEmpty { it.hashCode().toString() } }) { order ->
                    BulkOrderCard(
                        order = order,
                        colors = colors,
                        onStatusChange = { newStatus ->
                            coroutineScope.launch {
                                try {
                                    val res = RetrofitClient.instance.updateBulkOrderStatus(
                                        order.id,
                                        UpdateBulkStatusRequest(newStatus)
                                    )
                                    if (res.success) {
                                        Toast.makeText(context, "Status updated to $newStatus", Toast.LENGTH_SHORT).show()
                                        fetchOrders(showSpinner = false)
                                    } else {
                                        Toast.makeText(context, "Failed to update status", Toast.LENGTH_SHORT).show()
                                    }
                                } catch (e: Exception) {
                                    Toast.makeText(context, "Error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                                }
                            }
                        },
                        onDelete = {
                            coroutineScope.launch {
                                try {
                                    val res = RetrofitClient.instance.deleteBulkOrder(order.id)
                                    if (res.success) {
                                        Toast.makeText(context, "Bulk request removed", Toast.LENGTH_SHORT).show()
                                        fetchOrders(showSpinner = false)
                                    } else {
                                        Toast.makeText(context, "Failed to delete", Toast.LENGTH_SHORT).show()
                                    }
                                } catch (e: Exception) {
                                    Toast.makeText(context, "Error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                                }
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun BulkOrderCard(
    order: BulkOrder,
    colors: AppColors,
    onStatusChange: (String) -> Unit,
    onDelete: () -> Unit
) {
    val context = LocalContext.current
    var showStatusDialog by remember { mutableStateOf(false) }

    val statusColor = when (order.status.lowercase()) {
        "completed" -> Color(0xFF22C55E)
        "contacted" -> Color(0xFF3B82F6)
        else -> Color(0xFFF59E0B) // Pending
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 12.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(colors.cardBg)
            .padding(16.dp)
    ) {
        Column {
            // Header Row: ID + Status Badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = order.id.ifEmpty { "Inquiry" },
                    color = colors.accent,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp
                )

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(statusColor.copy(alpha = 0.15f))
                        .clickable { showStatusDialog = true }
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .clip(RoundedCornerShape(3.dp))
                                .background(statusColor)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = order.status,
                            color = statusColor,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Business & Quantity
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = order.business_name,
                    color = colors.textPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp,
                    modifier = Modifier.weight(1f)
                )

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(colors.accent.copy(alpha = 0.12f))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "📦 ${order.quantity} pcs",
                        color = colors.accent,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Contact Info
            Text(
                text = "Contact: ${order.customerName}",
                color = colors.textPrimary,
                fontSize = 14.sp
            )
            if (order.email.isNotBlank()) {
                Text(
                    text = "Email: ${order.email}",
                    color = colors.textSecondary,
                    fontSize = 13.sp
                )
            }
            if (order.phone.isNotBlank()) {
                Text(
                    text = "Phone: ${order.phone}",
                    color = colors.textSecondary,
                    fontSize = 13.sp
                )
            }
            if (order.created_at.isNotBlank()) {
                Text(
                    text = "Date: ${order.created_at.take(10)}",
                    color = colors.textSecondary.copy(alpha = 0.7f),
                    fontSize = 12.sp
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Actions row: Call, WhatsApp, Update Status
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Call button
                if (order.phone.isNotBlank()) {
                    Button(
                        onClick = {
                            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${order.phone}"))
                            context.startActivity(intent)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = colors.accent.copy(alpha = 0.15f)),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                        modifier = Modifier.height(36.dp)
                    ) {
                        Icon(Icons.Filled.Phone, contentDescription = "Call", tint = colors.accent, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Call", color = colors.accent, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }

                    // WhatsApp button
                    val cleanPhone = order.phone.replace("[^0-9]".toRegex(), "")
                    val targetPhone = if (cleanPhone.length == 10) "91$cleanPhone" else cleanPhone
                    Button(
                        onClick = {
                            val uri = Uri.parse("https://wa.me/$targetPhone?text=${Uri.encode("Hello ${order.first_name}, thank you for your bulk inquiry (${order.id}) with RestNest. We would love to assist you.")}")
                            val intent = Intent(Intent.ACTION_VIEW, uri)
                            context.startActivity(intent)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF25D366).copy(alpha = 0.15f)),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                        modifier = Modifier.height(36.dp)
                    ) {
                        Text("WhatsApp", color = Color(0xFF25D366), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }

                // Status dropdown/quick button
                Button(
                    onClick = { showStatusDialog = true },
                    colors = ButtonDefaults.buttonColors(containerColor = colors.accent),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                    modifier = Modifier.height(36.dp)
                ) {
                    Text("Status", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }

    if (showStatusDialog) {
        AlertDialog(
            onDismissRequest = { showStatusDialog = false },
            title = { Text("Update Order Status", color = colors.textPrimary) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Select new status for ${order.id}:", color = colors.textSecondary)
                    listOf("Pending", "Contacted", "Completed").forEach { st ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (order.status.equals(st, ignoreCase = true)) colors.accent.copy(alpha = 0.2f) else Color.Transparent)
                                .clickable {
                                    showStatusDialog = false
                                    onStatusChange(st)
                                }
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(st, color = colors.textPrimary, fontWeight = FontWeight.Medium)
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showStatusDialog = false }) {
                    Text("Cancel", color = colors.accent)
                }
            }
        )
    }
}
