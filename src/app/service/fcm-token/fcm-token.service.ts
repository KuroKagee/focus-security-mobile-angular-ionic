import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

/**
 * FcmTokenService
 *
 * On iOS, Capacitor's PushNotifications plugin returns the raw APNs device token
 * (a 64-char hex string like "80DE504...") from the 'registration' event.
 * Firebase expects its own FCM token (format "fXP...:APA91bG..." with a colon).
 *
 * AppDelegate.swift dispatches a custom DOM event 'FCMTokenReceived' containing
 * the real Firebase FCM token. This service waits for that event on iOS, or falls
 * back to the standard Capacitor registration flow on Android.
 */
@Injectable({
  providedIn: 'root'
})
export class FcmTokenService {

  private cachedToken: string | null = null;

  constructor() {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      document.addEventListener('FCMTokenReceived', (e: any) => {
        const token: string = e.detail;
        console.log('📱 FcmTokenService: Firebase FCM token cached:', token);
        this.cachedToken = token;
      });
    }
  }

  /**
   * Returns the correct FCM token for the current platform.
   * iOS     -> waits for FCMTokenReceived DOM event from AppDelegate (real Firebase token)
   * Android -> standard Capacitor PushNotifications registration flow
   */
  async getToken(timeoutMs = 15000): Promise<string | null> {
    if (!Capacitor.isNativePlatform()) {
      return null;
    }
    return Capacitor.getPlatform() === 'ios'
      ? this.getFirebaseTokenForIos(timeoutMs)
      : this.getAndroidToken(timeoutMs);
  }

  // ---- iOS ----

  private getFirebaseTokenForIos(timeoutMs: number): Promise<string | null> {
    return new Promise((resolve) => {
      if (this.cachedToken) {
        console.log('📱 FcmTokenService (iOS): returning cached Firebase token');
        resolve(this.cachedToken);
        return;
      }

      console.log('📱 FcmTokenService (iOS): waiting for FCMTokenReceived event…');

      const handler = (e: any) => {
        const token: string = e.detail;
        this.cachedToken = token;
        clearTimeout(timer);
        document.removeEventListener('FCMTokenReceived', handler);
        resolve(token);
      };

      document.addEventListener('FCMTokenReceived', handler);

      const timer = setTimeout(() => {
        document.removeEventListener('FCMTokenReceived', handler);
        console.warn('📱 FcmTokenService (iOS): timed out — no Firebase token received');
        resolve(null);
      }, timeoutMs);

      // Trigger APNs registration so AppDelegate fires FCMTokenReceived
      PushNotifications.register().catch(() => {
        clearTimeout(timer);
        document.removeEventListener('FCMTokenReceived', handler);
        resolve(null);
      });
    });
  }

  // ---- Android ----

  private getAndroidToken(timeoutMs: number): Promise<string | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), timeoutMs);

      PushNotifications.addListener('registration', (token) => {
        clearTimeout(timer);
        resolve(token.value || null);
      });

      PushNotifications.addListener('registrationError', () => {
        clearTimeout(timer);
        resolve(null);
      });

      PushNotifications.register();
    });
  }
}
