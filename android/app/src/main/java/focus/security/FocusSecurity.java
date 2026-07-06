package com.sgeede.focus.security;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import android.content.Context;
import android.app.NotificationManager;
import com.sgeede.focus.security.MyFirebaseMessagingService;

public class FocusSecurity extends Application {
    private static boolean isInForeground = false;

    @Override
    public void onCreate() {
        super.onCreate();

        registerActivityLifecycleCallbacks(new ActivityLifecycleCallbacks() {
            private int activityCount = 0;

            @Override
            public void onActivityStarted(Activity activity) {
                activityCount++;
                isInForeground = activityCount > 0;
            }

            @Override
            public void onActivityStopped(Activity activity) {
                activityCount--;
                if (activityCount <= 0) {
                    isInForeground = false;
                }
            }

            @Override
            public void onActivityResumed(Activity activity) {
                cancelCallNotification(activity);
            }

            // Sisanya kosongin
            @Override public void onActivityCreated(Activity activity, Bundle bundle) {}
            @Override public void onActivityPaused(Activity activity) {}
            @Override public void onActivitySaveInstanceState(Activity activity, Bundle bundle) {}
            @Override public void onActivityDestroyed(Activity activity) {}
        });
    }

    public static boolean isAppInForeground() {
        return isInForeground;
    }

    private void cancelCallNotification(Context context) {
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.cancel(3001);
        }
        MyFirebaseMessagingService.stopRingtone();
    }
}
