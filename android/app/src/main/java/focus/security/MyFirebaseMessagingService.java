/**
 * Copyright 2016 Google Inc. All Rights Reserved.
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * <p>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.sgeede.focus.security;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.content.SharedPreferences;
import android.service.notification.StatusBarNotification;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import android.util.Log;
import androidx.core.app.Person;
import androidx.core.graphics.drawable.IconCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.sgeede.focus.security.R;
import android.widget.RemoteViews;

import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.WorkRequest;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.content.Context;
import com.sgeede.focus.security.CallActionReceiver;
import java.util.Map;
import com.bumptech.glide.Glide;
import com.bumptech.glide.request.target.CustomTarget;
import com.bumptech.glide.request.transition.Transition;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory; // ADD THIS IMPORT
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import android.graphics.drawable.Drawable;
import java.util.HashMap;
import java.io.ByteArrayOutputStream;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.drawable.IconCompat;
import android.os.PowerManager;
import com.sgeede.focus.security.FocusSecurity;

/**
 * NOTE: There can only be one service in each app that receives FCM messages. If multiple
 * are declared in the Manifest then the first one will be chosen.
 *
 * In order to make this Java sample functional, you must remove the following from the Kotlin messaging
 * service in the AndroidManifest.xml:
 *
 * <intent-filter>
 *   <action android:name="com.google.firebase.MESSAGING_EVENT" />
 * </intent-filter>
 */
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "MyFirebaseMsgService";
    private static Ringtone ringtone;
    private static Vibrator vibrator;

    /**
     * Called when message is received.
     *
     * @param remoteMessage Object representing the message received from Firebase Cloud Messaging.
     */
    // [START receive_message]
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        // [START_EXCLUDE]
        // There are two types of messages data messages and notification messages. Data messages
        // are handled
        // here in onMessageReceived whether the app is in the foreground or background. Data
        // messages are the type
        // traditionally used with GCM. Notification messages are only received here in
        // onMessageReceived when the app
        // is in the foreground. When the app is in the background an automatically generated
        // notification is displayed.
        // When the user taps on the notification they are returned to the app. Messages
        // containing both notification
        // and data payloads are treated as notification messages. The Firebase console always
        // sends notification
        // messages. For more see: https://firebase.google.com/docs/cloud-messaging/concept-options
        // [END_EXCLUDE]

        // TODO(developer): Handle FCM messages here.
        // Not getting messages here? See why this may be: https://goo.gl/39bRNJ
        Log.e(TAG, "From: " + remoteMessage.getFrom());
        // NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        // Check if message contains a data payload.
        boolean isForeground = FocusSecurity.isAppInForeground();
        Log.e(TAG, "Check Foreground: " + isForeground);
        if (remoteMessage.getData().size() > 0) {
            Log.e(TAG, "Message data payload: " + remoteMessage.getData());

            if (/* Check if data needs to be processed by long running job */ true) {
                // For long-running tasks (10 seconds or more) use WorkManager.
                scheduleJob();
            } else {
                // Handle message within 10 seconds
                handleNow();
            }

        }

        // Check if message contains a notification payload.
        if (remoteMessage.getData().size() > 0) {
            Log.e(TAG, "Message data payload: " + remoteMessage.getData());

            String callerName = remoteMessage.getData().get("callerName");

            if (remoteMessage.getData().containsKey("type") && remoteMessage.getData().get("type").equals("incoming_call") && !isForeground) {
                wakeUpScreen(getApplicationContext());
                Log.e(TAG, "Message data payload incoming_call: " + remoteMessage.getData());
                Glide.with(this)
                    .asBitmap()
                    .load(remoteMessage.getData().get("imgurl"))
                    .into(new CustomTarget<Bitmap>() {
                        @Override
                        public void onResourceReady(@NonNull Bitmap resource, @Nullable Transition<? super Bitmap> transition) {
                            sendNotification(callerName, remoteMessage.getData(), resource);
                            playRingtone();
                        }

                        @Override
                        public void onLoadCleared(@Nullable Drawable placeholder) { }
                    });
            } else if (remoteMessage.getData().containsKey("type") && remoteMessage.getData().get("type").equals("notification_tampan_dan_berani")) {
                Log.e(TAG, "Message data payload notification_tampan_dan_berani: " + remoteMessage.getData());
                wakeUpScreen(getApplicationContext());
                Bitmap caller = BitmapFactory.decodeResource(getResources(),  R.drawable.ic_stat_ifs360_logo_transparent);
                sendAppNotification(remoteMessage.getData(), caller);
            } else if (remoteMessage.getData().containsKey("type") && remoteMessage.getData().get("type").equals("call_rejected")) {
                Log.e(TAG, "Message data payload notification_tampan_dan_berani call_rejected: " + remoteMessage.getData());
                Glide.with(this)
                    .asBitmap()
                    .load(remoteMessage.getData().get("imgurl"))
                    .into(new CustomTarget<Bitmap>() {
                        @Override
                        public void onResourceReady(@NonNull Bitmap resource, @Nullable Transition<? super Bitmap> transition) {
                            showDefaultNotification(remoteMessage.getData().get("title"), remoteMessage.getData().get("body"), resource);
                        }

                        @Override
                        public void onLoadCleared(@Nullable Drawable placeholder) { }
                    });
            } else if (remoteMessage.getData().containsKey("type") && remoteMessage.getData().get("type").equals("vms_call_rejected")) {
                NotificationManager notificationManager =
                    (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

                stopRingtone();
                notificationManager.cancel(3001);
            }
        }
        // Also if you intend on generating your own notifications as a result of a received FCM
        // message, here is where that should be initiated. See sendNotification method below.
    }
    // [END receive_message]


    // [START on_new_token]
    /**
     * There are two scenarios when onNewToken is called:
     * 1) When a new token is generated on initial app startup
     * 2) Whenever an existing token is changed
     * Under #2, there are three scenarios when the existing token is changed:
     * A) App is restored to a new device
     * B) User uninstalls/reinstalls the app
     * C) User clears app data
     */
    @Override
    public void onNewToken(String token) {
        Log.e(TAG, "Refreshed token: " + token);

        // If you want to send messages to this application instance or
        // manage this apps subscriptions on the server side, send the
        // FCM registration token to your app server.
        sendRegistrationToServer(token);
    }
    // [END on_new_token]

    /**
     * Schedule async work using WorkManager.
     */
    private void scheduleJob() {
        // [START dispatch_job]
        OneTimeWorkRequest work = new OneTimeWorkRequest.Builder(MyWorker.class)
                .build();
        WorkManager.getInstance(this).beginWith(work).enqueue();
        // [END dispatch_job]
    }

    /**
     * Handle time allotted to BroadcastReceivers.
     */
    private void handleNow() {
        Log.d(TAG, "Short lived task is done.");
    }

    /**
     * Persist token to third-party servers.
     *
     * Modify this method to associate the user's FCM registration token with any
     * server-side account maintained by your application.
     *
     * @param token The new token.
     */
    private void sendRegistrationToServer(String token) {
        // TODO: Implement this method to send token to your app server.
    }

    private void playRingtone() {
        Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        ringtone = RingtoneManager.getRingtone(getApplicationContext(), ringtoneUri);
        if (ringtone != null) {
            ringtone.setLooping(true); 
            ringtone.play();
        }

        vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (vibrator != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(
                    new long[]{0, 500, 500}, 
                    0 
                ));
            } else {
                vibrator.vibrate(1000);
            }
        }
    }

    public static void stopRingtone() {
        if (ringtone != null && ringtone.isPlaying()) {
            ringtone.stop();
        }

        if (vibrator != null) {
            vibrator.cancel();
            Log.d("MyFirebaseMessagingService", "Vibration stopped.");
        }
    }

    private void wakeUpScreen(Context context) {
        PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        boolean isScreenOn = powerManager.isInteractive(); // API >= 20
        if (!isScreenOn) {
            PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
                PowerManager.FULL_WAKE_LOCK |
                PowerManager.ACQUIRE_CAUSES_WAKEUP |
                PowerManager.ON_AFTER_RELEASE,
                "FocusApp::CallWakeLock"
            );
            wakeLock.acquire(3000); // Wake the screen for 3 seconds
        }
    }

    /**
     * Create and show a simple notification containing the received FCM message.
     *
     * @param messageBody FCM message body received.
     */

    // private void sendNotification(String callerName, Map<String, String> data, Bitmap callerImage) {
    //     NotificationManager notificationManager =
    //         (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

    //     stopRingtone();
    //     notificationManager.cancel(0);

    //     Intent intent = new Intent(this, MainActivity.class);
    //     intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
    //     PendingIntent pendingIntent = PendingIntent.getActivity(
    //             this, 0, intent, PendingIntent.FLAG_IMMUTABLE);

    //     String channelId = getString(R.string.default_notification_channel_id);
    //     Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);

    //     Intent acceptIntent = new Intent(this, CallActionReceiver.class);
    //     acceptIntent.setAction("com.sgeede.focus.security.ACTION_ACCEPT_CALL");
    //     acceptIntent.putExtra("receiverName", data.get("receiverName"));
    //     acceptIntent.putExtra("callerName", data.get("callerName"));
    //     acceptIntent.putExtra("callerSocketId", data.get("callerSocketId"));
    //     PendingIntent acceptPendingIntent = PendingIntent.getBroadcast(
    //             this, 0, acceptIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);

    //     Intent rejectIntent = new Intent(this, CallActionReceiver.class);
    //     rejectIntent.setAction("com.sgeede.focus.security.ACTION_REJECT_CALL");
    //     rejectIntent.putExtra("receiverName", data.get("receiverName"));
    //     rejectIntent.putExtra("callerName", data.get("callerName"));
    //     rejectIntent.putExtra("callerSocketId", data.get("callerSocketId"));
    //     PendingIntent rejectPendingIntent = PendingIntent.getBroadcast(
    //             this, 1, rejectIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);

    //     // Gunakan custom layout
    //     RemoteViews customLayoutSmall = new RemoteViews(getPackageName(), R.layout.floating_call_layout_small);
    //     customLayoutSmall.setTextViewText(R.id.notification_title, callerName);


    private void sendNotification(String callerName, Map<String, String> data, Bitmap callerImage) {
        NotificationManager notificationManager =
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        stopRingtone();
        notificationManager.cancel(3001);

        String channelId = getString(R.string.default_notification_channel_id);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Person caller = new Person.Builder()
                    .setName(callerName)
                    .setImportant(true)
                    .setIcon(IconCompat.createWithBitmap(callerImage))
                    .build();

            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
            intent.putExtra("callAction", "openDialogCall");
            intent.putExtra("receiverName", data.get("receiverName"));
            intent.putExtra("callerName", data.get("callerName"));
            intent.putExtra("callerSocketId", data.get("callerSocketId"));
            intent.putExtra("unitId", data.get("unitId"));
            PendingIntent fullScreenIntent = PendingIntent.getActivity(
                    this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            Intent acceptIntent = new Intent(this, MainActivity.class);
            acceptIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
            acceptIntent.setAction("com.sgeede.focus.security.ACTION_ACCEPT_CALL");
            acceptIntent.putExtra("callAction", "acceptCall");
            acceptIntent.putExtra("receiverName", data.get("receiverName"));
            acceptIntent.putExtra("callerName", data.get("callerName"));
            acceptIntent.putExtra("callerSocketId", data.get("callerSocketId"));
            acceptIntent.putExtra("unitId", data.get("unitId"));
            PendingIntent acceptPendingIntent = PendingIntent.getActivity(
                    this, 1, acceptIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            Intent rejectIntent = new Intent(this, MainActivity.class);
            rejectIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
            rejectIntent.setAction("com.sgeede.focus.security.ACTION_REJECT_CALL");
            rejectIntent.putExtra("callAction", "rejectCall");
            rejectIntent.putExtra("receiverName", data.get("receiverName"));
            rejectIntent.putExtra("callerName", data.get("callerName"));
            rejectIntent.putExtra("callerSocketId", data.get("callerSocketId"));
            rejectIntent.putExtra("unitId", data.get("unitId"));
            PendingIntent rejectPendingIntent = PendingIntent.getActivity(
                    this, 2, rejectIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(channelId,
                        "Call Notification Channel",
                        NotificationManager.IMPORTANCE_HIGH);
                channel.setDescription("Notifikasi untuk panggilan masuk");
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                channel.setBypassDnd(true);
                channel.setSound(null, null); 
                notificationManager.createNotificationChannel(channel);
                
            }
            NotificationCompat.Builder notificationBuilder = new NotificationCompat.Builder(this, channelId)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(data.get("callerName"))
                    .setContentText("Incoming Call")
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_CALL)
                    .setOngoing(true)
                    .setAutoCancel(false)
                    .setFullScreenIntent(fullScreenIntent, true)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                notificationBuilder.setStyle(NotificationCompat.CallStyle.forIncomingCall(
                        caller,
                        rejectPendingIntent,
                        acceptPendingIntent 
                ));
            }

            // Tampilkan notifikasi dengan ID unik
            notificationManager.notify(3001, notificationBuilder.build());
            return;
        }


        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent fullScreenIntent = PendingIntent.getActivity(
                this, 0, intent, PendingIntent.FLAG_IMMUTABLE);

        Intent acceptIntent = new Intent(this, CallActionReceiver.class);
        acceptIntent.setAction("com.sgeede.focus.security.ACTION_ACCEPT_CALL");
        acceptIntent.putExtra("receiverName", data.get("receiverName"));
        acceptIntent.putExtra("callerName", data.get("callerName"));
        acceptIntent.putExtra("callerSocketId", data.get("callerSocketId"));
        acceptIntent.putExtra("unitId", data.get("unitId"));
        PendingIntent acceptPendingIntent = PendingIntent.getBroadcast(
                this, 0, acceptIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);

        Intent rejectIntent = new Intent(this, CallActionReceiver.class);
        rejectIntent.setAction("com.sgeede.focus.security.ACTION_REJECT_CALL");
        rejectIntent.putExtra("receiverName", data.get("receiverName"));
        rejectIntent.putExtra("callerName", data.get("callerName"));
        rejectIntent.putExtra("callerSocketId", data.get("callerSocketId"));
        rejectIntent.putExtra("unitId", data.get("unitId"));
        PendingIntent rejectPendingIntent = PendingIntent.getBroadcast(
                this, 1, rejectIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);

        RemoteViews customLayoutSmall = new RemoteViews(getPackageName(), R.layout.floating_call_layout_small);
        customLayoutSmall.setTextViewText(R.id.notification_title, callerName);

        RemoteViews customLayout = new RemoteViews(getPackageName(), R.layout.floating_call_layout);
        customLayout.setTextViewText(R.id.notif_caller_name, callerName);
        customLayout.setImageViewBitmap(R.id.notif_icon, callerImage);
        customLayout.setOnClickPendingIntent(R.id.btn_accept_call, acceptPendingIntent);
        customLayout.setOnClickPendingIntent(R.id.btn_reject_call, rejectPendingIntent);

        NotificationCompat.Builder notificationBuilder =
            new NotificationCompat.Builder(this, channelId)
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
                    .setCustomContentView(customLayoutSmall)
                    .setCustomBigContentView(customLayout)
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_CALL)
                    .setGroup("groupKey_none")
                    .setGroupSummary(false) // Individual notification
                    .setOngoing(true)
                    .setAutoCancel(false)
                    .setFullScreenIntent(fullScreenIntent, true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId,
                    "Call Notification Channel",
                    NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Notifikasi untuk panggilan masuk");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            notificationManager.createNotificationChannel(channel);
        }

        notificationManager.notify(3001, notificationBuilder.build());
    }

    private void showDefaultNotification(String title, String message, Bitmap image) {
        NotificationManager notificationManager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        stopRingtone();
        notificationManager.cancel(3001);
        String channelId = getString(R.string.default_notification_channel_id);

        // Intent ketika notifikasi diklik
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Gunakan RemoteViews untuk custom layout
        RemoteViews customView = new RemoteViews(getPackageName(), R.layout.missed_call_layout);
        customView.setTextViewText(R.id.notif_title, title);
        customView.setTextViewText(R.id.notif_body, message);
        if (image != null) {
            customView.setImageViewBitmap(R.id.notif_image, image);
        }

        // Buat notifikasi
        NotificationCompat.Builder notificationBuilder =
                new NotificationCompat.Builder(this, channelId)
                        .setSmallIcon(android.R.drawable.ic_dialog_info)
                        .setCustomContentView(customView)
                        .setContentIntent(pendingIntent)
                        .setAutoCancel(true)
                        .setPriority(NotificationCompat.PRIORITY_MAX);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId,
                    "Default Notifications",
                    NotificationManager.IMPORTANCE_HIGH);
            notificationManager.createNotificationChannel(channel);
        }

        notificationManager.notify(3001, notificationBuilder.build());
    }

    private void sendAppNotification(Map<String, String> data, Bitmap callerImage) {
        Log.e(TAG, "Starting App Notifications");
        NotificationManager notificationManager =
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        String channelId = getString(R.string.default_notification_channel_id);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                channelId,
                "App Notifications",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notifications for messages");
            channel.setShowBadge(true);
            notificationManager.createNotificationChannel(channel);
        }

        Log.e(TAG, "Title: " + data.get("notification_title"));
        Log.e(TAG, "Body: " + data.get("notification_body"));

        // Buat Intent untuk membuka aplikasi
        Intent intent = new Intent(this, MainActivity.class); // Ganti MainActivity dengan Activity utama Anda
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP); // Clear stack dan buka activity di top
        
        // Optional: Tambah extra data jika diperlukan
        intent.putExtra("notification_data", data.get("notification_body"));
        intent.putExtra("from_notification", true);

        // UNTUK STACKING - Buat summary notification
        String groupKey = "app_notifications_ifs360"; // Key untuk grouping

        // Buat PendingIntent
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 
            0, 
            intent, 
            PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
        );

        // Generate unique notification ID
        int notificationId = (int) System.currentTimeMillis(); // Atau bisa pakai Random

        // Get notification count
        int notificationCount = 1;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            StatusBarNotification[] activeNotifications = notificationManager.getActiveNotifications();
            notificationCount = 0;
            for (StatusBarNotification notification : activeNotifications) {
                if (notification.getId() != 9999 && groupKey.equals(notification.getNotification().getGroup())) {
                    notificationCount++;
                }
            }
            notificationCount++; // Add current notification
        } else {
            // Fallback: get from SharedPreferences
            SharedPreferences prefs = getSharedPreferences("notification_prefs", MODE_PRIVATE);
            notificationCount = prefs.getInt("notification_count", 0) + 1;
            prefs.edit().putInt("notification_count", notificationCount).apply();
        }

        // Small view
        RemoteViews smallView = new RemoteViews(getPackageName(), R.layout.notification_layout_small);
        smallView.setTextViewText(R.id.notif_title, data.get("notification_title"));

        // Big view
        RemoteViews bigView = new RemoteViews(getPackageName(), R.layout.notification_layout);
        bigView.setTextViewText(R.id.notif_title, data.get("notification_title"));
        bigView.setTextViewText(R.id.notif_body, data.get("notification_body"));

        NotificationCompat.Builder notificationBuilder =
            new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.drawable.ic_stat_ifs360_logo_transparent) // Icon di status bar
                .setCustomContentView(smallView)
                .setCustomBigContentView(bigView)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setStyle(new NotificationCompat.DecoratedCustomViewStyle()) // PENTING!
                .setGroup(groupKey) // PENTING: Set group untuk stacking
                .setBadgeIconType(NotificationCompat.BADGE_ICON_SMALL)
                .setNumber(notificationCount)
                .setGroupSummary(false); // Individual notification
        
        notificationManager.notify(notificationId, notificationBuilder.build());

        // BUAT SUMMARY NOTIFICATION untuk stacking
        NotificationCompat.Builder summaryBuilder =
            new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.drawable.ic_stat_ifs360_logo_transparent)
                .setContentTitle("App Notifications")
                .setContentText("You have" + notificationCount + "new messages")
                .setGroup(groupKey)
                .setBadgeIconType(NotificationCompat.BADGE_ICON_SMALL)
                .setNumber(notificationCount)
                .setGroupSummary(true) // PENTING: Ini adalah summary
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

        // Kirim summary notification
        notificationManager.notify(9999, summaryBuilder.build()); // ID unik untuk summary
    }
}