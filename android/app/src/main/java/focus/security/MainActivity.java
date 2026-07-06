package com.sgeede.focus.security;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import android.util.Log;
import com.sgeede.focus.security.MyFirebaseMessagingService;
import com.sgeede.focus.security.NavigationTypePlugin;
import java.util.ArrayList;
import com.getcapacitor.Plugin;
import android.app.NotificationManager;
import android.content.Context;
import com.sgeede.focus.security.plugin.RingtonePlugin;
import android.content.res.Configuration;
import android.content.res.Resources;

import android.util.DisplayMetrics;
import android.os.Build;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }

        registerPlugin(RingtonePlugin.class);
        registerPlugin(NavigationTypePlugin.class);
        super.onCreate(savedInstanceState);

        getWindow().addFlags(
            android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
            android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        );
        handleIntent(getIntent());
        handleNotificationIntent(getIntent());
        
    }

    //tambah
    // @Override
    // protected void onNewIntent(Intent intent) {
    //     super.onNewIntent(intent);
    //     if (bridge != null) {
    //         bridge.onNewIntent(intent); 
    //     }
    // }

    @Override
    protected void attachBaseContext(Context newBase) {
        super.attachBaseContext(applyDensityOverride(newBase));
    }

    @Override
    public Resources getResources() {
        Resources res = super.getResources();
        applyDensityOverride(res);
        return res;
    }

    private Context applyDensityOverride(Context context) {
        Configuration config = new Configuration(context.getResources().getConfiguration());
        applyDensityOverride(config, context.getResources().getDisplayMetrics());
        return context.createConfigurationContext(config);
    }

    private void applyDensityOverride(Resources res) {
        if (res == null) return;
        applyDensityOverride(res.getConfiguration(), res.getDisplayMetrics());
    }

    private void applyDensityOverride(Configuration config, DisplayMetrics dm) {
        config.fontScale = 1.0f;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            int targetDpi = DisplayMetrics.DENSITY_DEVICE_STABLE;
            config.densityDpi = targetDpi;
            dm.densityDpi = targetDpi;
            dm.density = (float) targetDpi / DisplayMetrics.DENSITY_DEFAULT;
            dm.scaledDensity = dm.density * config.fontScale;
        }
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyDensityOverride(getResources());
    }

    @Override
    public void onResume() {
        super.onResume();
        // Force text zoom to 100% in the WebView
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().getSettings().setTextZoom(100);
        }
    }
    
    //selesai

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (bridge != null) {
            bridge.onNewIntent(intent); 
        }
        handleNotificationIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) {
            return;
        }

        Bundle extras = intent.getExtras();
        if (extras != null && extras.containsKey("callAction")) {
            NotificationManager notificationManager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            notificationManager.cancel(3001);
            MyFirebaseMessagingService.stopRingtone();
            Log.e("MainActivity", "Masukkk: ");
            String callAction = intent.getStringExtra("callAction");
            String receiverName = intent.getStringExtra("receiverName");
            String callerSocketId = intent.getStringExtra("callerSocketId");
            String callerName = intent.getStringExtra("callerName");
            String unitId = intent.getStringExtra("unitId");
            Log.e("MainActivity", "callAction received here: " + callAction);
            if (bridge.getWebView() != null) {
                bridge.getWebView().post(() -> {
                    String js =
                        "let existingData = localStorage.getItem('callData');" +
                        "let newCall = { callAction: '" + callAction + "', callerName: '" + callerName + "', unitId: '" + unitId +
                        "', receiverName: '" + receiverName + "', callerSocketId: '" + callerSocketId + "' };" +
                        "if (existingData) {" +
                        "    let parsedData = JSON.parse(existingData);" +
                        "    if (!Array.isArray(parsedData)) { parsedData = [parsedData]; }" +
                        "    parsedData.push(newCall);" +
                        "    localStorage.setItem('callData', JSON.stringify(parsedData));" +
                        "} else {" +
                        "    localStorage.setItem('callData', JSON.stringify([newCall]));" +
                        "}";
                    bridge.getWebView().evaluateJavascript(js, null);
                });
            }
        }
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent != null) {
            // Check jika dari notifikasi
            if (intent.getBooleanExtra("from_notification", false)) {
                String notificationData = intent.getStringExtra("notification_data");
                Log.d("MainActivity", "Dibuka dari notifikasi: " + notificationData);
                
                // Lakukan action khusus di sini
                // Misalnya: buka halaman tertentu, tampilkan dialog, dll
            }
            
            // Atau check dengan action
            if ("NOTIFICATION_CLICKED".equals(intent.getAction())) {
                Bundle extras = intent.getExtras();
                if (extras != null) {
                    String title = extras.getString("title");
                    String body = extras.getString("body");
                    Log.d("MainActivity", "Notification clicked - Title: " + title + ", Body: " + body);
                    
                    // Handle sesuai kebutuhan
                }
            }
        }
    }

}
