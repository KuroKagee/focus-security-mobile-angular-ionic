import { Injectable } from '@angular/core';
import { io } from 'socket.io-client';
import { ModalController, Platform, ToastController } from '@ionic/angular';
import { Router } from '@angular/router'; // Import Router
import { Capacitor } from '@capacitor/core';
import { WebView } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { jwtDecode } from 'jwt-decode';
import { OutgoingCallPage } from 'src/app/modules/call_module/outgoing-call/outgoing-call.page';
import { IncomingCallPage } from 'src/app/modules/call_module/incoming-call/incoming-call.page';
import { OngoingCallPage } from 'src/app/modules/call_module/ongoing-call/ongoing-call.page';
import { SplashCallPage } from 'src/app/modules/call_module/splash-call/splash-call.page';
import { ApiService } from '../api.service';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../resident/authenticate/authenticate.service';
import { StorageService } from '../storage/storage.service';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { BehaviorSubject } from 'rxjs';
import { registerPlugin } from '@capacitor/core';
import { ClientMainService } from '../client-app/client-main.service';
import { MainVmsService } from '../vms/main_vms/main-vms.service';
import { Estate } from 'src/models/resident/resident.model';
interface RingtonePlugin {
  play(): Promise<void>;
  stop(): Promise<void>;
  playOutgoing(): Promise<void>;
  stopOutgoing(): Promise<void>;
}

const Ringtone = registerPlugin<RingtonePlugin>('Ringtone', {
  android: {
    pkg: 'com.sgeede.focus.security.plugin',
    class: 'RingtonePlugin'
  }
});


@Injectable({
  providedIn: 'root'
})
export class WebRtcService extends ApiService {
  private socket: any;
  private peerConnection!: RTCPeerConnection;
  private localStream!: MediaStream;
  private remoteStream!: MediaStream;
  // private iceServers: RTCIceServer[] = [
  //   { urls: 'stun:stun.l.google.com:19302'},
  // ];
  // private iceServers: RTCIceServer[] = [
  //   {
  //     urls: ['stun:fastturn.pro:3478']
  //   },
  //   {
  //     urls: 'turn:fastturn.pro:3478?transport=udp',
  //     username: 'Dendy',
  //     credential: 'Kepulauan_2504',
  //   },
  //   {
  //     urls: 'turn:fastturn.pro:3478?transport=tcp',
  //     username: 'Dendy',
  //     credential: 'Kepulauan_2504',
  //   },
  //   {
  //     urls: 'turns:fastturn.pro:5349?transport=tcp',
  //     username: 'Dendy',
  //     credential: 'Kepulauan_2504',
  //   }
  //   // { urls: 'stun:fastturn.pro:3478', 'username': 'Dendy', 'credential': 'Kepulauan_2504' },
  //   // { urls: 'stun:fastturn.pro:5349', 'username': 'Dendy', 'credential': 'Kepulauan_2504' },
  //   // { urls: 'turn:fastturn.pro:3478', 'username': 'Dendy', 'credential': 'Kepulauan_2504' },
  //   // { urls: 'turns:fastturn.pro:5349', 'username': 'Dendy', 'credential': 'Kepulauan_2504' }
  // ];
  private iceServers: RTCIceServer[] = [
    {
      "urls": "stun:relay17.expressturn.com:3478"
    },
    {
      "urls": "turn:relay17.expressturn.com:3478?transport=tcp",
      "username": "000000002072154862",
      "credential": "IUtn4d1i+sMuTM1lagsqrzsOBzI="
    }
  ]
  private activeModal: HTMLIonModalElement | null = null;
  private callerName: string = '';
  private receiverName: string = '';
  private callerSocketId: any;
  private hostCode: any = ''
  private receiverSocketId: any;
  private nativeOffer: any;
  private targetSocketIds: any;
  private project_id: any;
  private callAction: string = '';
  private callerId: number = 0;
  private receiverId: number = 0;
  private unitId: number = 0;
  private userName: string = '';
  private userId: number = 0;
  private modalLock = false;
  private pendingCandidates: RTCIceCandidate[] = [];
  private callerpendingCandidates: RTCIceCandidate[] = [];
  private remoteDescriptionSet = false;
  audioStatus = new BehaviorSubject<string>('');
  callActionStatus = new BehaviorSubject<string>('');

  constructor(http: HttpClient, private storage: StorageService, private toastController: ToastController, private modalController: ModalController,
    private router: Router,
    private platform: Platform,
    private mainVmsService: MainVmsService
  ) {
    super(http);
    this.initializeSocket();
  }

  private listenForNativeEvents() {
    const storedAction = localStorage.getItem('callData');
    if (storedAction) {
      const parsedAction = JSON.parse(storedAction);
      if (Array.isArray(parsedAction) && parsedAction.length > 0) {
        const actionData = parsedAction[0];
        this.callerName = actionData.callerName;
        this.receiverName = actionData.receiverName;
        this.callerSocketId = actionData.callerSocketId;
        this.receiverId = parseInt(actionData.receiverId, 10) || 0;
        this.callAction = actionData.callAction;
        this.callActionStatus.next(actionData.callAction);
        this.unitId = actionData.unitId;
        // If user tapped Decline on the iOS push notification, emit reject-call immediately
        if (actionData.callAction === 'rejectCall') {
          this.rejectCall();
        }
      }
      localStorage.removeItem('callData');
    }
  }

  async presentSingletonModal(component: any, componentProps: any = {}) {
    if (this.modalLock) return;
    this.modalLock = true;

    try {
      // Tutup semua modal aktif terlebih dahulu
      let topModal = await this.modalController.getTop();
      while (topModal) {
        try {
          await topModal.dismiss();
        } catch (e) {
          console.warn('Gagal dismiss modal:', e);
        }
        topModal = await this.modalController.getTop();
      }

      const modal = await this.modalController.create({
        component,
        componentProps,
        backdropDismiss: false,
        showBackdrop: false,
        cssClass: 'non-blocking-modal',
      });

      modal.onDidDismiss().then(() => {
        this.modalLock = false;
      });

      await modal.present().then(() => {
        setTimeout(() => {
          const outerDiv = document.querySelector('ion-modal.non-blocking-modal');
          const backdrop = outerDiv?.shadowRoot?.querySelector('ion-backdrop')
          backdrop?.remove()
        }, 1000)
      });;
    } catch (e) {
      console.error('Gagal membuka modal:', e);
      this.modalLock = false;
    }
    this.callActionStatus.next('');
  }

  // async showSplashScreen(){
  //   if (this.activeModal) {
  //     await this.activeModal.dismiss();
  //     this.activeModal = null;
  //   }
  //   this.activeModal = await this.modalController.create({
  //     component: SplashCallPage,
  //     backdropDismiss: false,
  //   });
  //   return await this.activeModal.present();
  // }

  //  async showOutgoingCallModal() {
  //   if (this.activeModal) {
  //     await this.activeModal.dismiss();
  //     this.activeModal = null;
  //   }
  //   this.activeModal = await this.modalController.create({
  //     component: OutgoingCallPage,
  //     componentProps: { receiverName: this.receiverName },
  //     backdropDismiss: false,
  //   });
  //   return await this.activeModal.present();
  // }

  // async showIncomingCallModal(offer: any) {
  //   if (this.activeModal) {
  //     await this.activeModal.dismiss();
  //     this.activeModal = null;
  //   }
  //   await this.playRingtone();
  //   this.activeModal = await this.modalController.create({
  //     component: IncomingCallPage,
  //     componentProps: { offer: offer, callerName: this.callerName },
  //     backdropDismiss: false,
  //   });
  //   return await this.activeModal.present();
  // }

  // async showOngoingCallModal(isReceiver: boolean) {
  //   if (this.activeModal) {
  //     await this.activeModal.dismiss();
  //     this.activeModal = null;
  //   }
  //   this.activeModal = await this.modalController.create({
  //     component: OngoingCallPage,
  //     componentProps: { isReceiver: isReceiver },
  //     backdropDismiss: false,
  //   });
  //   return await this.activeModal.present();
  // }

  async showIncomingCallModal(offer: any) {
    if (this.callerName) {
      await this.playRingtone();
      return this.presentSingletonModal(IncomingCallPage, {
        offer: offer,
        callerName: this.callerName,
      });
    }
  }

  async showOutgoingCallModal() {
    return this.presentSingletonModal(OutgoingCallPage, {
      receiverName: this.receiverName,
    });
  }

  isReceiver = false
  async showOngoingCallModal(isReceiver: boolean) {
    this.isReceiver = isReceiver
    const topModal = await this.modalController.getTop();
    if (topModal) {
      try {
        await topModal.dismiss();
      } catch (e) {
        console.warn('Gagal dismiss modal lama:', e);
      }
    }
    // this.startRecording()
    return this.presentSingletonModal(OngoingCallPage, {
      isReceiver,
    });
  }

  async showSplashScreen() {
    return this.presentSingletonModal(SplashCallPage);
  }

  private async resetCallData() {
    try {
      if (this.activeModal) {
        await this.activeModal.dismiss();
        this.activeModal = null;
      }

      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null!;
      }

      this.remoteStream = null!;

      if (this.peerConnection) {
        this.peerConnection.onicecandidate = null;
        this.peerConnection.ontrack = null;
        this.peerConnection.onconnectionstatechange = null;
        this.peerConnection.close();
        this.peerConnection = null!;
      }

      this.callerName = '';
      this.hostCode = '';
      this.receiverName = '';
      this.callerSocketId = null;
      this.receiverSocketId = null;
      this.nativeOffer = null;
      this.targetSocketIds = null;
      this.project_id = null;
      this.callAction = '';
      this.unitId = 0;
      this.pendingCandidates = [];
      this.callerpendingCandidates = [];
      this.remoteDescriptionSet = false;
      this.callActionStatus.next('');

      localStorage.removeItem('callData');
    } catch (error) {
      console.error("Error during clearCallData:", error);
    }
  }


  // initializeSocket() {

  //   this.storage.getValueFromStorage('USESATE_DATA').then((value: any) => {
  //     this.storage.decodeData(value).then(async (value: any) => {

  //       if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
  //         this.socket.close();
  //       }

  //       let userInfo = {
  //         family_mobile_number: 'Public-User',
  //         family_id: '',
  //         family_name: 'Security',
  //         email: 'admin@example.com',
  //       }

  //       let clientInfo;

  //       if (value) {
  //         userInfo = JSON.parse(value);
  //         console.log("userInfo", userInfo)
  //       }

  //       if (!userInfo.family_id){
  //         console.log("masukk kesini");
  //         const clientData = await Preferences.get({ key: 'USER_INFO' });
  //         if (clientData.value) {
  //           let parsedClient = jwtDecode(clientData.value) as {name:string, family_id:number};
  //           userInfo.family_name = parsedClient.name;
  //           userInfo.family_id = parsedClient.family_id ? parsedClient.family_id.toString() : '';
  //         }
  //       }

  //       // this.presentToast(JSON.stringify(userInfo), 'danger');
  //       console.log("hereeee -->", userInfo);
  //       this.userName = userInfo.family_name ? userInfo.family_name : 'Security';
  //       this.userId = userInfo.family_id ? parseInt(userInfo.family_id, 10) || 0 : 0;
  //       this.socket = io('wss://ws.sgeede.com', {
  //         query: { uniqueId: userInfo.family_id ? userInfo.family_id : 'Public-User' }
  //       });
  //       this.socket.on('offer', (offer: any) => this.handleOffer(offer));
  //       this.socket.on('answer', (answer: any) => this.handleAnswer(answer));
  //       this.socket.on('ice-candidate', (candidate: any) => this.handleICECandidate(candidate));
  //       this.socket.on('end-call', () => this.handleEndCall());
  //       this.socket.on('reject-call', () => this.handleRejectCall());
  //       this.socket.on('user-not-found', (data: any) => this.handleUserNotFound(data));
  //       this.socket.on('receiver-info', (data: any) => this.handleReceiverInfo(data));
  //       this.socket.on('receiver-pending-call', (data: any) => this.handleReceiverPendingCall(data));
  //       this.socket.on('sender-pending-call', (data: any) => this.handleSenderPendingCall(data));
  //       this.listenForNativeEvents();
  //     }).catch(error => {
  //       console.error('Error fetching phone info:', error);
  //     });
  //   });
  // }

  async initializeSocket() {
    console.log("RUN INITIAL SOCKET")
    try {
      let userInfo = {
        family_mobile_number: 'Public-User',
        family_id: '',
        family_name: 'Security',
        email: 'admin@example.com',
      };

      // Coba ambil dari USESTATE_DATA
      // if (this.callAction){
      //   this.showSplashScreen();
      // }
      const storedValue = await this.storage.getValueFromStorage('USESATE_DATA');
      if (storedValue) {
        try {
          const decoded = await this.storage.decodeData(storedValue);
          if (decoded) {
            const parsedResident = JSON.parse(decoded);
            if (parsedResident.family_id) {
              userInfo = parsedResident;
              console.log("Got userInfo from USESTATE_DATA", userInfo);
            }
          }
        } catch {
        }
      }

      if (!userInfo.family_id) {
        const clientData = await Preferences.get({ key: 'USER_INFO' });
        if (clientData.value) {
          const parsedClient = jwtDecode(clientData.value) as { name: string; family_id: number };
          if (parsedClient.family_id) {
            userInfo.family_name = parsedClient.name;
            userInfo.family_id = parsedClient.family_id.toString();
            console.log("Got userInfo from USER_INFO", userInfo);
          }
        }
      }

      if (!userInfo.family_id) {
        const vmsData = await Preferences.get({ key: 'USER_INFO' }).then((result) => {
          if (result.value) {
            const parsedVMS = jwtDecode(result.value) as { project_name: string; project_id: number, vms_family_id: string };
            console.log(parsedVMS)
            if (parsedVMS.project_id && parsedVMS.project_name) {
              userInfo.family_name = 'Security';
              userInfo.family_id = parsedVMS.vms_family_id;
            }
          }
        });
      }

      // Set default kalau tetap kosong
      if (!userInfo.family_id) {
        userInfo.family_mobile_number = 'Public-User';
        userInfo.family_id = 'Public-User';
        userInfo.family_name = 'Security';
        console.log("Fallback to default userInfo", userInfo);
      }

      // Tutup socket lama jika ada
      // ✅ FIX: Use socket.connected (Socket.IO API) — the old check used
      // WebSocket.CLOSED (value 3) which is a native WebSocket constant and
      // never worked correctly on a Socket.IO socket.
      if (this.socket?.connected) {
        // Already connected with this user — skip creating a new socket.
        // A new socket would cause the server to emit kick-user-testing-demo
        // to the existing socket, triggering a false-positive kick-out.
        console.log('Socket already connected — skipping re-initialization');
        this.listenForNativeEvents();
        return;
      }
      if (this.socket) {
        this.socket.disconnect();
      }

      // Setup user
      this.userName = userInfo.family_name || 'Security';
      this.userId = userInfo.family_id ? parseInt(userInfo.family_id, 10) || 0 : 0;

      // Connect ke WebSocket
      // this.socket = io('wss://ws.sgeede.com', {
      this.socket = io('http://192.168.1.217:8091', {
        query: { uniqueId: userInfo.family_id || 'Public-User' },
      });

      console.log(this.socket, "enicencieninceicneicencienciecn");


      // Register event handlers
      this.socket.on('offer', (offer: any) => this.handleOffer(offer));
      this.socket.on('answer', (answer: any) => this.handleAnswer(answer));
      this.socket.on('ice-candidate', (candidate: any) => this.handleICECandidate(candidate));
      this.socket.on('end-call', () => this.handleEndCall());
      this.socket.on('reject-call', () => this.handleRejectCall());
      this.socket.on('user-not-found', (data: any) => this.handleUserNotFound(data));
      this.socket.on('receiver-info', (data: any) => this.handleReceiverInfo(data));
      this.socket.on('receiver-pending-call', (data: any) => this.handleReceiverPendingCall(data));
      this.socket.on('sender-pending-call', (data: any) => this.handleSenderPendingCall(data));
      this.socket.on('open-modal-call', (data: any) => this.handleOngoingCallModal());
      this.socket.on('kick-user-testing-demo', (data: any) => this.handleKickUser(data));
      // this.socket.on('kick-user-expiry', (data: any) => this.handleKickUserExpiry(data));
      this.socket.on('intercom-open-gate', (data: any) => this.handleOpenGate(data));
      this.socket.on('intercom-close-gate', (data: any) => this.handleCloseGate(data));
      this.socket.on('handle-vms-sync-state', (data: any) => this.handleChangeStateVMS(data));

      // Listen for native events
      this.listenForNativeEvents();

    } catch (error) {
      console.error('Error during socket initialization:', error);
    }
  }
  async handleOpenGate(data: any) {

  }

  async handleCloseGate(data: any) {

  }

  async openGate(intercom_id: any, is_from_call: any = false) {
    console.log(this.receiverId, this.callerId)
    console.log(this.isReceiver ? this.callerId : this.receiverId)
    console.log('receiver:', this.receiverSocketId, 'caller', this.callerSocketId)
    if (is_from_call) {
      console.log(this.callerId)
      this.socket.emit('intercom-open-gate', { intercom_id: this.isReceiver ? this.callerId : this.receiverId });
      // this.socket.emit('end-call', {
      //   receiverSocketId: this.receiverSocketId,
      //   callerSocketId: this.callerSocketId
      // });
    } else {
      console.log("EMITTED")
      this.socket.emit('intercom-open-gate', { intercom_id: intercom_id });
    }
  }

  async closeGate(intercom_id: any) {
    console.log("EMITTED")
    this.socket.emit('intercom-close-gate', { intercom_id: intercom_id });
  }

  closeSocket() {
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      this.socket.close();
    }
  }

  async playRingtone() {
    if (Capacitor.getPlatform() === 'android') {
      try {
        await Ringtone.play();
      } catch (err) {
        console.error('Ringtone error:', err);
      }
    } else {
      console.log('Ringtone not supported on this platform.');
    }
  }

  async stopRingtone() {
    if (Capacitor.getPlatform() === 'android') {
      try {
        await Ringtone.stop();
      } catch (err) {
        console.error('Ringtone error:', err);
      }
    } else {
      console.log('Ringtone not supported on this platform.');
    }
  }

  async playOutgoingRingtone() {
    if (Capacitor.getPlatform() === 'android') {
      try {
        await Ringtone.playOutgoing();
      } catch (err) {
        console.error('Ringtone Outgoing error:', err);
      }
    } else {
      console.log('Ringtone not supported on this platform.');
    }
  }

  async stopOutgoingRingtone() {
    if (Capacitor.getPlatform() === 'android') {
      try {
        await Ringtone.stopOutgoing();
      } catch (err) {
        console.error('Ringtone outgoing error:', err);
      }
    } else {
      console.log('Ringtone not supported on this platform.');
    }
  }

  async startLocalStream(): Promise<boolean> {
    try {
      // 1. Cek apakah MediaDevices API tersedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('MediaDevices API or getUserMedia not available');
        return false;
      }

      // 2. iOS-specific constraints - lebih konservatif
      const constraints = {
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // iOS Safari kadang bermasalah dengan constraint tambahan
          // Hapus atau simplify jika masih bermasalah
          sampleRate: 44100, // iOS prefer standard sample rate
          channelCount: 1     // Mono audio untuk iOS
        }
      };

      console.log('Requesting media permissions...');

      // 3. Request stream dengan error handling yang lebih detail
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!this.localStream) {
        console.error('Failed to get media stream');
        return false;
      }

      console.log('Media stream obtained successfully');

      // 4. Handle video element dengan iOS-specific considerations
      const videoElement: HTMLVideoElement = document.getElementById('local-video') as HTMLVideoElement;
      if (videoElement) {
        // iOS Safari memerlukan properti tambahan
        videoElement.srcObject = this.localStream;
        videoElement.muted = true; // Penting untuk iOS - hindari feedback
        videoElement.playsInline = true; // Crucial untuk iOS - hindari fullscreen
        videoElement.autoplay = true; // iOS Safari memerlukan autoplay

        // iOS Safari kadang memerlukan user interaction untuk play
        try {
          await videoElement.play();
          console.log('Video element playing successfully');
        } catch (playError) {
          console.warn('Auto-play failed, might need user interaction:', playError);
          // Untuk iOS, kadang perlu user click untuk trigger play
          // Anda bisa show button "Tap to start" jika auto-play gagal
        }
      } else {
        console.warn('Video element not found');
      }

      return true;
    } catch (error) {
      console.error('Error starting local stream:', error);

      // Type guard untuk error handling
      if (error instanceof Error) {
        // Detail error handling untuk debugging
        if (error.name === 'NotAllowedError') {
          console.error('Permission denied by user');
        } else if (error.name === 'NotFoundError') {
          console.error('No audio input device found');
        } else if (error.name === 'NotReadableError') {
          console.error('Audio device is already in use');
        } else if (error.name === 'OverconstrainedError') {
          console.error('Constraints cannot be satisfied');
        } else if (error.name === 'SecurityError') {
          console.error('Security error - HTTPS required');
        }
      } else {
        console.error('Unknown error type:', error);
      }

      return false;
    }
  }

  async regenerateVideo() {
    if (!navigator.mediaDevices) {
      return;
    }
    const videoElement: HTMLVideoElement = document.getElementById('local-video') as HTMLVideoElement;
    if (videoElement) {
      videoElement.srcObject = this.localStream;
      await videoElement.play();
      videoElement.muted = true;
    }
    const remoteVideo: HTMLVideoElement = document.getElementById('remote-video') as HTMLVideoElement;
    if (remoteVideo) {
      remoteVideo.srcObject = this.remoteStream;
      await remoteVideo.play();
    }
  }

  async createOffer(receiverPhone: any = false, receiverId: any = false, unit_id: any = false, isResident: any = false) {
    if (!receiverId && !receiverPhone && !unit_id) {
      return;
    }

    await this.startLocalStream();

    this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers, iceTransportPolicy: 'all' });

    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', event.candidate);
        this.callerpendingCandidates.push(event.candidate);
      }
    };

    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      const remoteVideo: HTMLVideoElement = document.getElementById('remote-video') as HTMLVideoElement;
      remoteVideo.srcObject = this.remoteStream;
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;

      switch (state) {
        case "checking":
          this.updateAudioStatus("Connecting audio...");
          break;
        case "connected":
        case "completed":
          this.updateAudioStatus("Audio connected");
          break;
      }
    };

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.callerName = this.userName;
    this.callerId = this.userId;
    console.log(receiverId)
    this.socket.emit('offer', {
      offerObj: offer,
      receiverPhone: receiverPhone,
      receiverId: receiverId,
      callerName: this.callerName,
      callerId: this.callerId,
      unitId: unit_id,
      isResident: isResident
    });

    return 'done'
  }

  async receiverConnected() {
    this.socket.emit('receiver-connected', {});
  }

  async handleOffer(offer: any) {
    console.log(offer)
    await this.startLocalStream();
    if (!this.peerConnection) {
      this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers, iceTransportPolicy: 'all' });

      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket.emit('ice-candidate', event.candidate);
        }
      };

      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        const remoteVideo: HTMLVideoElement = document.getElementById('remote-video') as HTMLVideoElement;
        if (remoteVideo) {
          remoteVideo.srcObject = this.remoteStream;
        }
      };
      this.peerConnection.oniceconnectionstatechange = () => {
        const state = this.peerConnection.iceConnectionState;

        switch (state) {
          case "checking":
            this.updateAudioStatus("Connecting audio...");
            break;
          case "connected":
          case "completed":
            this.updateAudioStatus("Audio connected");
            break;
        }
      };
    } else {
    }
    this.callerName = offer.callerName;
    this.callerId = offer.callerId;
    this.receiverId = offer.receiverId;
    this.unitId = offer.unitId;
    this.receiverName = offer.receiverName;
    this.callerSocketId = offer.callerSocketId;
    this.receiverSocketId = offer.receiverSocketId;
    this.hostCode = offer.hostCode
    this.targetSocketIds = offer.targetSocketIds;
    this.project_id = offer.project_id;
    await this.showIncomingCallModal(offer.offerObj);
  }

  async handleAnswer(answer: any) {
    await this.stopOutgoingRingtone();
    await this.stopRingtone();

    this.callerName = answer.callerName;
    this.receiverName = answer.receiverName;
    this.receiverSocketId = answer.receiverSocketId;
    const description = new RTCSessionDescription(answer.answerObj);
    await this.peerConnection.setRemoteDescription(description);
    this.remoteDescriptionSet = true;
    for (const candidate of this.pendingCandidates) {
      await this.peerConnection.addIceCandidate(candidate);
    }

    await this.showOngoingCallModal(false);
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      if (!this.remoteStream) {
        const remoteVideo: HTMLVideoElement = document.getElementById('remote-video') as HTMLVideoElement;
        remoteVideo.srcObject = this.remoteStream;
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;

      console.log(state)
      switch (state) {
        case "checking":
          this.updateAudioStatus("Connecting audio...");
          break;
        case "completed":
          this.updateAudioStatus("Audio connected");
          break;
      }
    };
  }

  async handleICECandidate(candidate: RTCIceCandidate): Promise<void> {
    const iceCandidate = new RTCIceCandidate(candidate);
    if (this.remoteDescriptionSet) {
      await this.peerConnection.addIceCandidate(iceCandidate);
    } else {
      this.pendingCandidates.push(iceCandidate);
    }
  }

  async handleSenderPendingCall(data: any) {
    this.receiverSocketId = data.receiverSocketId;
    this.receiverId = data.receiverId;
    this.unitId = data.unitId;
    console.log('pending', this.receiverId)

    for (const candidate of this.callerpendingCandidates) {
      this.socket.emit('ice-candidate', candidate);
    }
  }

  family_id: any = false
  decoded: any = {}
  async handleKickUser(data: any) {
    this.family_id = false
    this.decoded = {}
    const clientData = (await Preferences.get({ key: 'USER_INFO' })).value;
    const storedValue = await this.storage.getValueFromStorage('USESATE_DATA');
    if (clientData) {
      try {
        // console.log("THING 1")
        this.decoded = jwtDecode(clientData)
        this.family_id = this.decoded.family_id
        // console.log(this.decoded)
      } catch (error) {
        this.decoded = JSON.parse(await this.storage.decodeData(storedValue));
        // console.log(this.decoded)
        this.family_id = this.decoded.family_id
      }
    } else if (storedValue) {
      try {
        this.decoded = JSON.parse(await this.storage.decodeData(storedValue));
        // console.log(this.decoded)
        this.family_id = this.decoded.family_id
      } catch (error) {
        console.log(error)
        this.decoded = {}
        this.family_id = false
      }
    } else {
      this.decoded = {}
      this.family_id = false
    }
    if (this.family_id) {
      this.http.post<any>(`${this.baseUrl}/get/fcm_token`, { jsonrpc: '2.0', params: { family_id: this.family_id } }).subscribe(
        res => {
          console.log(res)
          if (res.result['status_code'] == 200) {
            var fcm_token = res.result['status_desc'];
            this.getFCMToken().then(token => {
              // Skip comparison if token could not be determined
              // (null = iOS FCMTokenReceived timed out or not yet available)
              if (token === null || token === undefined || token === '') {
                console.log('FCM token not available — skipping kick-out check');
                return;
              }
              if (token != fcm_token) {
                console.log(this.platform.platforms(), this.platform.platforms().join(', '));

                const isDesktop = this.platform.is('mobileweb') || this.platform.is('desktop');
                console.log("Is Dekstop", isDesktop);

                if (isDesktop) {
                  console.log("You are in desktop device", isDesktop);
                } else {
                  this.presentToast('You are about to get kick out from application in 3 second because your account has been login on another device.', 'warning')
                  console.log('You are about to get kick out from application in 3 second because your account has been login on another device.', 'warning');
                  setTimeout(() => {
                    this.closeSocket();
                    this.storage.clearAllValueFromStorage();
                    Preferences.clear();
                    this.router.navigate(['']);
                  }, 3000)
                }
              } else {
              }
            });
          } else {
            console.log("ERROR OVER HEY")
          }
        },
        error => {
          console.log(error)
        }
      )
    }
  }

  // async handleKickUserExpiry(data: any) {
  //   this.family_id = false
  //   const today = new Date();
  //   today.setHours(0, 0, 0, 0); 
  //   this.decoded = {}
  //   const storedValue = await this.storage.getValueFromStorage('USESATE_DATA');
  //   if (storedValue) {
  //     try {
  //       this.decoded = JSON.parse(await this.storage.decodeData(storedValue)) as Estate;
  //       // console.log(this.decoded)
  //       this.family_id = this.decoded.family_id
  //     } catch (error) {
  //       console.log(error)
  //       this.decoded = {}
  //       this.family_id = false
  //     }
  //   } else {
  //     this.decoded = {}
  //     this.family_id = false
  //   }
  //   console.log(this.decoded, this.decoded.family_type, this.family_id);
  //   if (this.decoded.family_type === 'Helper' || this.decoded.family_type === 'helper' || this.decoded.family_type === 'Tenants' ||this.decoded.family_type === 'tenants') {
  //     console.log("Got u");
  //     if (this.family_id) {
  //       console.log("Got here");
  //       this.http.post<any>(`${this.baseUrl}/resident/get/get_expiry_last_for_helper_and_tenants`, { jsonrpc: '2.0', params: { family_id: this.family_id } }).subscribe(
  //         res => {
  //           console.log(res, "sefwemfvuwmvwumiunwvwuinwiufeuvnwiuneuwfnqfiwmevuwvn")
  //           if (res.result.response_code === 200 || res.result.response_code === 404) {

  //             const expiryDate = new Date(res.result.expiry_date);
  //             expiryDate.setHours(0, 0, 0, 0);
  //             console.log("Expiry Date:", expiryDate);
  //             console.log("Today Date:", today);

  //             const isExpired = expiryDate < today;
  //             console.log("Is Expired:", isExpired);
  //             if (isExpired) {
  //               this.presentToast('Your about to get kick out from application in 3 second because your account has reach the expiry date, please contact your household.', 'warning')
  //               setTimeout(() => {
  //                 this.notifyService.cleanUp();
  //                 this.closeSocket();
  //                 this.storage.clearAllValueFromStorage();
  //                 Preferences.clear();
  //                 this.router.navigate(['']);
  //               }, 3000)
  //             } else {
  //               console.log('Tidak ada notifikasi expiry date');
  //             }
  //           } else {
  //             console.log('Check expiry failed:', res.result.response_message);
  //           }
  //         },
  //         error => {
  //           console.log(error)
  //         }
  //       )
  //     }
  //   }
  // }

  async getFCMToken(): Promise<string | null> {
    try {
      if (!Capacitor.isNativePlatform()) {
        return null;
      }

      // ✅ FIX: On iOS, the AppDelegate dispatches the real Firebase FCM token
      // via a custom DOM event 'FCMTokenReceived' after mapping the APNs token.
      // Calling PushNotifications.register() here would return the raw APNs hex
      // token (different format from the Firebase FCM token stored in Odoo),
      // causing a false-positive mismatch in handleKickUser.
      if (Capacitor.getPlatform() === 'ios') {
        return new Promise<string | null>((resolve) => {
          // If AppDelegate already fired the event, it stored the token on window
          const cached = (window as any).__firebaseFCMToken;
          if (cached) {
            resolve(cached);
            return;
          }

          const handler = (e: Event) => {
            const token = (e as CustomEvent<string>).detail;
            (window as any).__firebaseFCMToken = token;  // cache for next call
            document.removeEventListener('FCMTokenReceived', handler);
            resolve(token);
          };
          document.addEventListener('FCMTokenReceived', handler);

          // Safety timeout — returns null so handleKickUser skips the comparison
          setTimeout(() => {
            document.removeEventListener('FCMTokenReceived', handler);
            resolve(null);
          }, 5000);
        });
      }

      // Android: standard PushNotifications registration flow
      const permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted') {
        return null;
      }

      return new Promise((resolve, reject) => {
        PushNotifications.addListener('registration', (token) => {
          resolve(token.value);
        });

        PushNotifications.addListener('registrationError', (error) => {
          reject(null);
        });

        PushNotifications.register();
      });
    } catch (error) {
      return null;
    }
  }

  async handleReceiverPendingCall(data: any) {
    this.nativeOffer = data.offerObj;
    this.callerId = data.callerId;
    this.callerSocketId = data.callerSocketId;
    this.receiverSocketId = data.receiverSocketId;
    this.targetSocketIds = data.targetSocketIds;
    this.project_id = data.project_id;
    if (this.callAction === 'acceptCall') {
      await this.startLocalStream();
      if (!this.peerConnection) {
        // Inisialisasi peerConnection untuk User 2
        this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers, iceTransportPolicy: 'all' });

        // Pastikan remote stream belum ada
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }

        // Set up ICE candidate handler
        this.peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            this.socket.emit('ice-candidate', event.candidate);
          }
        };

        // Set up track handler untuk remote video
        this.peerConnection.ontrack = (event) => {
          this.remoteStream = event.streams[0];
          const remoteVideo: HTMLVideoElement = document.getElementById('remote-video') as HTMLVideoElement;
          if (remoteVideo) {
            remoteVideo.srcObject = this.remoteStream;
          }
        };
        this.peerConnection.oniceconnectionstatechange = () => {
          const state = this.peerConnection.iceConnectionState;

          switch (state) {
            case "checking":
              this.updateAudioStatus("Connecting audio...");
              break;
            case "connected":
            case "completed":
              this.updateAudioStatus("Audio connected");
              break;
          }
        };
      } else {
      }

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.nativeOffer));
      this.remoteDescriptionSet = true;
      for (const candidate of this.pendingCandidates) {
        await this.peerConnection.addIceCandidate(candidate);
      }

      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.socket.emit('answer', {
        answerObj: answer,
        receiverName: this.receiverName,
        callerName: this.callerName,
        callerSocketId: this.callerSocketId,
        receiverSocketId: data.receiverSocketId,
      });

      await this.showOngoingCallModal(true);
    } else if (this.callAction === 'rejectCall') {
      this.rejectCall();
      // }else if(this.callAction === 'openDialogCall'){
    } else {
      if (!this.callerName) return
      await this.startLocalStream();
      if (!this.peerConnection) {
        this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers, iceTransportPolicy: 'all' });

        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }

        this.peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            this.socket.emit('ice-candidate', event.candidate);
          }
        };

        this.peerConnection.ontrack = (event) => {
          this.remoteStream = event.streams[0];
          const remoteVideo: HTMLVideoElement = document.getElementById('remote-video') as HTMLVideoElement;
          if (remoteVideo) {
            remoteVideo.srcObject = this.remoteStream;
          }
        };
        this.peerConnection.oniceconnectionstatechange = () => {
          const state = this.peerConnection.iceConnectionState;

          switch (state) {
            case "checking":
              this.updateAudioStatus("Connecting audio...");
              break;
            case "connected":
            case "completed":
              this.updateAudioStatus("Audio connected");
              break;
          }
        };
      }
      await this.showIncomingCallModal(this.nativeOffer);
    }
  }


  async acceptCall(offer: any) {
    await this.stopRingtone();
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    this.remoteDescriptionSet = true;
    for (const candidate of this.pendingCandidates) {
      await this.peerConnection.addIceCandidate(candidate);
    }

    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.startRecordingWithWebAudio(this.localStream, this.remoteStream)

    this.socket.emit('answer', {
      answerObj: answer,
      receiverName: this.receiverName,
      callerName: this.callerName,
      callerSocketId: this.callerSocketId,
      receiverSocketId: this.receiverSocketId,
      hostCode: this.hostCode,
    });
  }

  async handleOngoingCallModal() {
    if (this.targetSocketIds) {
      let newTargetSocketIds = this.targetSocketIds.filter((target: any) => target != this.receiverSocketId);
      this.socket.emit('reject-call', {
        targetSocketIds: newTargetSocketIds,
        project_id: this.project_id,
        unitId: this.unitId,
      });
    }
    await this.showOngoingCallModal(true);
  }

  async endCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null!;
    }

    if (this.socket) {
      console.log(this.receiverId, this.callerId)
      console.log('receiver:', this.receiverSocketId, 'caller', this.callerSocketId)
      this.socket.emit('end-call', {
        receiverSocketId: this.receiverSocketId,
        callerSocketId: this.callerSocketId
      });
    }
    await this.closeModal();
    this.resetCallData();
  }

  async handleEndCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null!;
    }
    await this.closeModal();
    this.stopRecordingWithWebAudio()
    this.resetCallData();
  }

  async handleRejectCall() {
    await this.stopOutgoingRingtone();
    await this.stopRingtone();
    await this.closeModal();
    this.resetCallData();
  }

  async rejectCall() {
    await this.stopOutgoingRingtone();
    await this.stopRingtone();
    this.socket.emit('reject-call', {
      callerSocketId: this.callerSocketId,
      receiverSocketId: this.receiverSocketId,
      targetSocketIds: this.targetSocketIds,
      project_id: this.project_id,
      receiverId: this.receiverId,
      unitId: this.unitId,
      callerId: this.callerId,
      callerName: this.callerName
    });
    await this.closeModal();
    this.resetCallData();
  }

  muteLocalAudio() {
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
    }
  }

  muteLocalVideo() {
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
    }
  }

  getLocalCam() {
    // console.log('local cam', this.localStream.getVideoTracks(), (this.localStream.getVideoTracks().length > 0 ? this.localStream.getVideoTracks()[0].enabled : false))
    return this.localStream.getVideoTracks().length > 0 ? this.localStream.getVideoTracks()[0].enabled : false
  }

  getRemoteCam() {
    // console.log('remote cam', this.remoteStream.getVideoTracks(), (this.remoteStream.getVideoTracks().length > 0 ? this.remoteStream.getVideoTracks()[0].enabled : false))
    return this.remoteStream.getVideoTracks().length > 0 ? this.remoteStream.getVideoTracks()[0].enabled : false
  }

  muteRemoteSpeaker() {
    const videoElement: HTMLVideoElement = document.getElementById('remote-video') as HTMLVideoElement;
    if (videoElement) {
      videoElement.muted = !videoElement.muted;
    }
  }

  async handleReceiverInfo(data: any) {
    console.log('handle receiver', data)
    this.callerId = data.callerId;
    this.receiverId = data.receiverId;
    this.callerName = data.callerName;
    this.receiverName = data.receiverName;
    this.callerSocketId = data.callerSocketId;
    this.receiverSocketId = data.receiverSocketId;
    this.targetSocketIds = data.targetSocketIds;
    this.project_id = data.project_id;
    await this.playOutgoingRingtone();
    await this.showOutgoingCallModal();
  }

  async handleUserNotFound(data: any) {
    await this.rejectCall();
    this.presentToast(data.message, 'danger');
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning' | 'dark' = 'success') {
    const toast = await this.toastController.create({
      message: message,
      duration: 4000,
      color: color
    });
    toast.present();
  }


  async closeModal() {
    const topModal = await this.modalController.getTop();
    if (topModal) {
      try {
        await topModal.dismiss();
      } catch (e) {
        console.warn('Gagal dismiss modal aktif:', e);
      }
    }
  }

  getCallerName() {
    return this.callerName;
  }
  getReceiverName() {
    return this.receiverName;
  }

  getSenderProfilePic() {
    if (this.callerId.toString().includes('Intercom')) {
      return `${this.baseUrl}/web/image/fs.residential.family/${0}/image_profile`;
    } else {
      return `${this.baseUrl}/web/image/fs.residential.family/${this.callerId}/image_profile`;
    }
  }
  getReceiverProfilePic() {
    if (this.receiverId.toString().includes('Intercom')) {
      return `${this.baseUrl}/web/image/fs.residential.family/${0}/image_profile`;
    } else {
      return `${this.baseUrl}/web/image/fs.residential.family/${this.receiverId}/image_profile`;
    }
  }

  updateAudioStatus(status: string) {
    this.audioStatus.next(status);
  }

  async actionMinimize() {
    const outerDiv = document.querySelector('ion-modal.non-blocking-modal');
    outerDiv?.classList.add('minimize-call-modal')
  }

  async actionMaximize() {
    const outerDiv = document.querySelector('ion-modal.non-blocking-modal');
    outerDiv?.classList.remove('minimize-call-modal')
  }

  mediaRecorder!: MediaRecorder;
  recordedChunks: BlobPart[] = [];

  combineStreams(streams: any) {
    const combined = new MediaStream();

    streams.forEach((stream: any) => {
      stream.getAudioTracks().forEach((track: any) => combined.addTrack(track));
    });
    console.log(combined)

    return combined;
  }

  async startRecording() {
    // const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const combinedStream = this.combineStreams([this.localStream, this.remoteStream]);
    console.log(combinedStream)

    this.mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType: 'audio/webm'
    });
    console.log(this.mediaRecorder)

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };
    console.log()

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, {
        type: 'audio/webm' // atau 'audio/webm' 
      }); // Simpan atau upload blob 
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'recorded-call.webm';
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
    };

    this.mediaRecorder.start();
  }

  startRecordingWithWebAudio(localStream: any, remoteStream: any) {

    this.recordedChunks = [];

    const audioCtx = new AudioContext();

    const dest = audioCtx.createMediaStreamDestination();

    // Create sources
    const localSource = audioCtx.createMediaStreamSource(localStream);
    const remoteSource = audioCtx.createMediaStreamSource(remoteStream);

    // Connect sources to destination
    localSource.connect(dest);
    remoteSource.connect(dest);

    // Record from mixed stream
    this.mediaRecorder = new MediaRecorder(dest.stream);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, {
        type: 'audio/webm'
      });

      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64Audio = reader.result;

        const payload = {
          audio: base64Audio,
          caller_id: this.callerId,
          receiver_id: this.receiverId,
          project_id: this.project_id
        };

        this.mainVmsService.getApi(payload, '/call/post/recorded_call').subscribe({
          next: (res) => console.log(res),
          error: (err) => console.error(err)
        });
      };

      audioCtx.close()
      this.mediaRecorder.stop()

      // const url = URL.createObjectURL(blob);
      // const a = document.createElement('a');
      // a.style.display = 'none';
      // a.href = url;
      // a.download = 'recorded-call.webm';
      // document.body.appendChild(a);
      // a.click();
      // URL.revokeObjectURL(url);
    };

    this.mediaRecorder.start();
  }

  stopRecordingWithWebAudio() {
    console.log(this.callerId, this.receiverId)
    this.mediaRecorder
    this.mediaRecorder.stop();
  }

  getIsFromIntercom() {
    let id = this.isReceiver ? this.callerId : this.receiverId
    return id ? id.toString().includes('Intercom') : false
  }

  changeStateVMS(project_id: any = false, fcm_ids: any = []) {
    if (!project_id) return
    this.socket.emit('vms-change-state', { project_id: project_id, fcm_ids: fcm_ids });
  }

  handleChangeStateVMS(data: any) {
    this.loadConfig(data)
  }

  async loadConfig(data: any = false) {
    let rggData: any = false
    let preference: any = false
    this.storage.getValueFromStorage('RGG_CALL_DATA').then(value => {
      if (value) {
        rggData = value
      } else {
        rggData = false
      }
      Preferences.get({ key: 'USER_INFO' }).then((result) => {
        if (result.value) {
          preference = jwtDecode(result.value);
          console.log(preference)
          if (data.fcm_ids.includes(preference.fcm_token_id)) {

            this.mainVmsService.getApi({ project_id: data.project_id, fcm_token_id: preference.fcm_token_id }, '/vms/get/current_config').subscribe({
              next: (results) => {
                console.log(results)
                if (results.result.status_code === 200) {
                  Preferences.clear()
                  Preferences.set({
                    key: 'USER_INFO',
                    value: results.result.response_status.access_token,
                  }).then(() => {
                    this.storage.clearAllValueFromStorage()
                    let storageData = {
                      'background': results.result.response_status.background
                    }
                    this.storage.setValueToStorage('USESATE_DATA', storageData)
                    let countryCodeData = results.result.response_status.country_codes.country_code_data
                    this.storage.setValueToStorage('COUNTRY_CODES_DATA', countryCodeData)
                    if (rggData) {
                      this.storage.setValueToStorage('RGG_CALL_DATA', rggData)
                    }
                  });
                  if (this.router.url.includes('home-vms')) {
                    this.mainVmsService.configUpdated$.next();
                  }
                } else {
                  this.presentToast('An error occurred while trying to get current config!', 'danger');
                }
              },
              error: (error) => {
                this.presentToast('An error occurred while trying to get current config!', 'danger');
                console.error(error);
              }
            });
          }
        }
      })
    })
  }

  maintenanceSocket: any = false;
  async initializeMaintenanceSocket() {
    try {
      // this.maintenanceSocket = io('wss://ws.sgeede.com', 
      this.maintenanceSocket = io('http://192.168.1.217:8091', {
        query: { isCheck: true },
      });
      this.maintenanceSocket.on('handle-server-response', (data: any) => this.handleServerResponse(data));
    }
    catch (error) {
      console.error('Error during socket initialization:', error);
    }
  }

  async checkServerMaintenance() {
    if (!this.maintenanceSocket) {
      await this.initializeMaintenanceSocket()
    }
    this.maintenanceSocket.emit('check-server-maintenance', {});
  }

  async handleServerResponse(data: any) {
    let is_maintenance = ((data['is_maintenance'] == 'True') ? this.checkMaintenanceHours(data) : false)
    if (!this.router.url.includes('maintenance-page')) {
      if (is_maintenance) {
        this.router.navigate(['/maintenance-page'], { state: data })
      }
    } else {
      if (!is_maintenance) {
        this.router.navigate(['/'],)
      }
    }
  }

  checkMaintenanceHours(data: any) {
    if (data['maintenance_start_time'] && data['maintenance_end_time']) {
      let currentdate = new Date()
      let startHour = new Date(currentdate);
      startHour.setHours(data['maintenance_start_time'].split(':')[0], data['maintenance_start_time'].split(':')[1], 0, 0)
      let endHour = new Date(currentdate);
      endHour.setHours(data['maintenance_end_time'].split(':')[0], data['maintenance_end_time'].split(':')[1], 0, 0)
      if (startHour <= currentdate && endHour >= currentdate) {
        return true
      } else {
        return false
      }
    } else {
      return false
    }
  }

}
