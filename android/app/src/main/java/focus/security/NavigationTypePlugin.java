package com.sgeede.focus.security;

import android.content.res.Configuration;
import android.content.res.Resources;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NavigationType")
public class NavigationTypePlugin extends Plugin {

    private String lastNavigationType = "";
    private View decorView;

    @Override
    public void load() {
        super.load();
        
        // Setup listener untuk detect perubahan
        decorView = getActivity().getWindow().getDecorView();
        
        decorView.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                checkNavigationTypeChange(insets);
                return insets;
            }
        });
    }

    @PluginMethod
    public void getNavigationType(PluginCall call) {
        JSObject result = detectNavigationType();
        call.resolve(result);
    }

    @PluginMethod
    public void startListening(PluginCall call) {
        // Method untuk mulai listen perubahan
        call.resolve();
    }

    private void checkNavigationTypeChange(WindowInsets insets) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            int navBarHeight = insets.getSystemWindowInsetBottom();
            float density = Resources.getSystem().getDisplayMetrics().density;
            int navBarHeightDp = (int) (navBarHeight / density);
            
            String type = navBarHeightDp < 40 ? "gesture" : "button";
            
            // Trigger event kalau berubah
            if (!type.equals(lastNavigationType)) {
                lastNavigationType = type;
                
                JSObject data = new JSObject();
                data.put("type", type);
                data.put("heightDp", navBarHeightDp);
                
                notifyListeners("navigationTypeChanged", data);
            }
        }
    }

    private JSObject detectNavigationType() {
        JSObject ret = new JSObject();
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            WindowInsets insets = decorView.getRootWindowInsets();
            if (insets != null) {
                int navBarHeight = insets.getSystemWindowInsetBottom();
                float density = Resources.getSystem().getDisplayMetrics().density;
                int navBarHeightDp = (int) (navBarHeight / density);
                
                String type = navBarHeightDp < 40 ? "gesture" : "button";
                lastNavigationType = type;
                
                ret.put("type", type);
                ret.put("heightDp", navBarHeightDp);
                ret.put("heightPx", navBarHeight);
                return ret;
            }
        }
        
        ret.put("type", "unknown");
        return ret;
    }
}