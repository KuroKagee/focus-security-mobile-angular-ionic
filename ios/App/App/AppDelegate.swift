import AVFoundation
import Capacitor
import Firebase
import FirebaseMessaging
import UIKit
import UserNotifications
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    // Looping audio player for foreground incoming-call ringtone
    private var audioPlayer: AVAudioPlayer?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        print("🔥 NOTIFICATION RECEIVED")
        // Firebase configuration
        FirebaseApp.configure()

        // Setup notification categories
        setupNotificationCategories()

        // ✅ Set delegate BEFORE requestAuthorization so notifications arriving
        // during the permission prompt are not silently dropped
        UNUserNotificationCenter.current().delegate = self

        // ✅ Tambahkan Firebase Messaging delegate
        Messaging.messaging().delegate = self

        // Request notification permissions
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) {
            granted, error in
            if granted {
                DispatchQueue.main.async {
                    application.registerForRemoteNotifications()
                }
            }
        }

        return true
    }

    // Function that returns a simple string value
    func getCustomValue() -> String {
        return "Hello from AppDelegate - \(Date())"
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate.
    }

    func application(
        _ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(
        _ application: UIApplication, continue userActivity: NSUserActivity,
        restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
    ) -> Bool {
        return ApplicationDelegateProxy.shared.application(
            application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // MARK: - Push Notifications
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        print("📱 APNs Device Token received")

        // ✅ PENTING: Set APNs token ke Firebase
        Messaging.messaging().apnsToken = deviceToken

        // Convert device token to string for logging
        let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }
        let apnsToken = tokenParts.joined()
        print("📱 APNs Token: \(apnsToken)")

        // ✅ Forward raw APNs token Data to Capacitor (required for JS PushNotifications.register() to resolve)
        NotificationCenter.default.post(
            name: .capacitorDidRegisterForRemoteNotifications,
            object: deviceToken
        )

        // ✅ Request FCM token setelah APNs token di-set
        requestFCMToken()
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("❌ Failed to register for remote notifications: \(error)")
        NotificationCenter.default.post(
            name: .capacitorDidFailToRegisterForRemoteNotifications,
            object: error
        )
    }

    // ✅ Method untuk request FCM token
    private func requestFCMToken() {
        Messaging.messaging().token { token, error in
            if let error = error {
                print("❌ Error fetching FCM registration token: \(error)")
            } else if let token = token {
                print("📱 FCM registration token: \(token)")
                print("📏 FCM Token length: \(token.count)")

                DispatchQueue.main.async {
                    if let rootView = self.window?.rootViewController?.view,
                       let webView = self.findWebView(in: rootView) {
                        let javascript = """
                                document.dispatchEvent(new CustomEvent('FCMTokenReceived', {
                                    detail: '\(token)'
                                }));
                            """
                        webView.evaluateJavaScript(javascript, completionHandler: nil)
                    }
                }

                // ✅ Simpan ke UserDefaults sebagai backup
                UserDefaults.standard.set(token, forKey: "FCMToken")
            }
        }
    }

    func setupNotificationCategories() {
        let answerAction = UNNotificationAction(
            identifier: "ANSWER_ACTION",
            title: "✅ Answer",
            options: [.foreground]  // opens app
        )

        let declineAction = UNNotificationAction(
            identifier: "DECLINE_ACTION",
            title: "❌ Decline",
            options: [.destructive, .foreground]  // opens app so JS can emit reject-call
        )

        let callCategory = UNNotificationCategory(
            identifier: "CALL_CATEGORY",
            actions: [answerAction, declineAction],
            intentIdentifiers: [],
            options: [.customDismissAction]
        )

        UNUserNotificationCenter.current().setNotificationCategories([callCategory])
    }

    // MARK: - Ringtone helpers
    private func playLoopingRingtone() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("⚠️ AVAudioSession setup failed: \(error)")
        }

        // Use bundled ringtone.caf if available, otherwise fall back to system ringtone (id 1007)
        if let soundURL = Bundle.main.url(forResource: "ringtone", withExtension: "caf")
            ?? Bundle.main.url(forResource: "ringtone", withExtension: "mp3") {
            do {
                audioPlayer = try AVAudioPlayer(contentsOf: soundURL)
                audioPlayer?.numberOfLoops = -1  // loop forever
                audioPlayer?.volume = 1.0
                audioPlayer?.play()
                return
            } catch {
                print("⚠️ Could not load ringtone file: \(error)")
            }
        }
        // Fallback: repeat system ringtone + vibration every 3 s
        AudioServicesPlaySystemSound(1007)
        AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
    }

    private func stopRingtone() {
        // Stop AVAudioPlayer loop (used when ringtone.caf / ringtone.mp3 is bundled)
        audioPlayer?.stop()
        audioPlayer = nil
        // Note: AudioServicesPlaySystemSound plays once and cannot be stopped — nothing to do here
    }

    // Recursively find WKWebView in the view hierarchy
    private func findWebView(in view: UIView) -> WKWebView? {
        if let wk = view as? WKWebView { return wk }
        for sub in view.subviews {
            if let found = findWebView(in: sub) { return found }
        }
        return nil
    }

    // Inject callData into Angular's localStorage so listenForNativeEvents() picks it up
    private func injectCallData(jsonString: String) {
        guard let rootView = self.window?.rootViewController?.view,
              let webView = findWebView(in: rootView) else { return }
        let escaped = jsonString.replacingOccurrences(of: "'", with: "\\'")  // escape single quotes
        webView.evaluateJavaScript("localStorage.setItem('callData', '\(escaped)');", completionHandler: nil)
    }
}

// MARK: - UNUserNotificationCenterDelegate
extension AppDelegate: UNUserNotificationCenterDelegate {

    // Called when notification arrives while app is in FOREGROUND
    func userNotificationCenter(
        _ center: UNUserNotificationCenter, willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        let userInfo = notification.request.content.userInfo
        let type = userInfo["type"] as? String ?? ""

        if type == "incoming_call" {
            print("📞 Incoming call notification — starting ringtone loop")
            playLoopingRingtone()
        }

        let content = notification.request.content
        print("📢 [willPresent] Title: \(content.title) | Body: \(content.body)")

        if type == "incoming_call" {
            // For calls: show banner + badge, audio player handles the sound
            completionHandler([.alert, .badge])
        } else {
            // For all other notifications: show banner + badge + system sound
            completionHandler([.alert, .badge, .sound])
        }
    }

    // Called when user taps the notification or one of its action buttons
    func userNotificationCenter(
        _ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        // Stop any looping ringtone
        stopRingtone()

        let userInfo = response.notification.request.content.userInfo
        let actionId = response.actionIdentifier

        // Extract call metadata from the data payload
        let callerName    = userInfo["callerName"]    as? String ?? ""
        let receiverName  = userInfo["receiverName"]  as? String ?? ""
        let callerSocketId = userInfo["callerSocketId"] as? String ?? ""
        let callerId      = userInfo["callerId"]      as? String ?? ""
        let receiverId    = userInfo["receiverId"]    as? String ?? ""
        let unitId        = userInfo["unitId"]        as? String ?? ""

        var callAction = ""
        if actionId == "ANSWER_ACTION" {
            callAction = "acceptCall"
            print("📞 Answer button tapped")
        } else if actionId == "DECLINE_ACTION" {
            callAction = "rejectCall"
            print("📞 Decline button tapped")
        } else {
            // Plain notification tap (no action button) — open app to incoming call screen
            callAction = "openDialogCall"
            print("📞 Notification body tapped")
        }

        let callData: [[String: String]] = [[
            "callAction":     callAction,
            "callerName":     callerName,
            "receiverName":   receiverName,
            "callerSocketId": callerSocketId,
            "callerId":       callerId,
            "receiverId":     receiverId,
            "unitId":         unitId
        ]]

        if let jsonData = try? JSONSerialization.data(withJSONObject: callData, options: []),
           let jsonString = String(data: jsonData, encoding: .utf8) {

            // Store in UserDefaults so the killed-app launch path also works
            UserDefaults.standard.set(jsonString, forKey: "pendingCallAction")

            // Try to inject immediately (works when app was suspended in background)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                self.injectCallData(jsonString: jsonString)
            }
        }

        NotificationCenter.default.post(
            name: NSNotification.Name("pushNotificationReceived"), object: response)
        completionHandler()
    }

    func application(
        _ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {

        print("🔔 Silent Push Received:", userInfo)
        // Lakukan sesuatu di background
        completionHandler(.newData)
    }
}

// MARK: - MessagingDelegate
extension AppDelegate: MessagingDelegate {
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        print("📱 Firebase FCM registration token updated: \(String(describing: fcmToken))")

        guard let token = fcmToken else {
            print("❌ FCM token is nil")
            return
        }

        print("📱 FCM Token length: \(token.count)")
        print("📱 FCM Token: \(token)")

        // ✅ Simpan ke UserDefaults
        UserDefaults.standard.set(token, forKey: "FCMToken")

        // // ✅ Post notification untuk JavaScript
        // DispatchQueue.main.async {
        //     NotificationCenter.default.post(
        //         name: NSNotification.Name("FCMTokenReceived"),
        //         object: token
        //     )
        // }

        DispatchQueue.main.async {
            if let rootView = self.window?.rootViewController?.view,
               let webView = self.findWebView(in: rootView) {
                let javascript = """
                        document.dispatchEvent(new CustomEvent('FCMTokenReceived', {
                            detail: '\(token)'
                        }));
                    """
                webView.evaluateJavaScript(javascript, completionHandler: nil)

                // ✅ Drain any pending call action stored when app was killed
                if let pending = UserDefaults.standard.string(forKey: "pendingCallAction") {
                    UserDefaults.standard.removeObject(forKey: "pendingCallAction")
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                        self.injectCallData(jsonString: pending)
                    }
                }
            }
        }

        // ✅ Optional: Send langsung ke server jika perlu
        // self.sendTokenToServer(token)
    }

    // Optional method untuk kirim token ke server
    private func sendTokenToServer(_ token: String) {
        // Implementasi untuk kirim token ke server Anda
        print("📤 Sending FCM token to server: \(token)")
    }
}
