import { Component } from '@angular/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { far } from '@fortawesome/free-regular-svg-icons';
import { fab } from '@fortawesome/free-brands-svg-icons';
import { App } from '@capacitor/app';
import { CheckAppVersionService } from './service/check-app-version/check-app-version.service';
import { Platform } from '@ionic/angular';
import { NotifyEndOfAgreementAndPermitService } from './service/notify-end-of-agreement-and-permit/notify-end-of-agreement-and-permit.service';
import { CheckServerResponseService } from './service/check-server-response/check-server-response.service';
import { Capacitor } from '@capacitor/core';

// Pre-cache Firebase FCM token from AppDelegate so FcmTokenService can return it immediately
if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
  document.addEventListener('FCMTokenReceived', (e: any) => {
    (window as any).__firebaseFCMToken = e.detail;
    console.log('📱 app.component: Firebase FCM token pre-cached');
  });
}

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  constructor(library: FaIconLibrary, private AppVersionService: CheckAppVersionService, private NotifyEndOfAgreementAndPermitService: NotifyEndOfAgreementAndPermitService, public platform: Platform, private CheckResponse: CheckServerResponseService) {
    library.addIconPacks(fas, far, fab);
    // Preferences.set({ key: 'usePreferredTextZoom', value: 'false' });
    App.addListener('appStateChange', async ({ isActive }) => {
    });
    document.body.classList.toggle('dark', false);
    if (StatusBar) {
      StatusBar.setStyle({ style: Style.Light });
    }
    this.initializeApp();
  }

  initializeApp() {
    this.platform.ready().then(() => {
      // Mulai periodic check setiap 2 menit
      this.AppVersionService.startPeriodicCheck();
      this.NotifyEndOfAgreementAndPermitService.startPeriodicCheck();
      this.CheckResponse.startPeriodicCheck()
    });
  }

}
