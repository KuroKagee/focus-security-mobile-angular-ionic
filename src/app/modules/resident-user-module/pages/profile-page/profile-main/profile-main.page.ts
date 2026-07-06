import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { trigger, style, animate, transition } from '@angular/animations';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { FcmTokenService } from 'src/app/service/fcm-token/fcm-token.service';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { Subscription } from 'rxjs';
import { AlertController, Platform } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

import { StorageService } from 'src/app/service/storage/storage.service';
import { Estate } from 'src/models/resident/resident.model';
import { FunctionMainService } from 'src/app/service/function/function-main.service';
import { MainApiResidentService } from 'src/app/service/resident/main/main-api-resident.service';
import { WebRtcService } from 'src/app/service/fs-web-rtc/web-rtc.service';

interface InputForm {
  familyNickname: string,
  employeeExtensionNumber: string,
  nameCondominium: string;
  statusOwner: string;
  blockName: string;
  unitName: string;
  email: string;
  phone: string;
  intercomCode: string;
}

interface InputData {
  id: string;
  formParams: keyof InputForm; // Menggunakan keyof untuk memastikan hanya kunci yang valid
  name: string;
  disabledInput: boolean;
}

interface pet {
  id: number;
  notes: string;
  pet_breed: string;
  pet_image: string;
  type_of_pet: string;
  upload_license: string;
}

@Component({
  selector: 'app-profile-main',
  templateUrl: './profile-main.page.html',
  styleUrls: ['./profile-main.page.scss'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(100%)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ opacity: 0, transform: 'translateX(-100%)' }))
      ])
    ])
  ]
})
export class ProfileMainPage implements OnInit, OnDestroy {
  @ViewChild(IonContent) content!: IonContent;

  pageName: string = '';
  showMain: boolean = true;
  showEstate: boolean = false;
  showBanVisitorContractor: boolean = false;
  showPets: boolean = false;

  imageProfile: string = '';
  familyId: number = 0;
  userName: string = '';
  userType: string = '';
  inputForm: InputForm = {
    familyNickname: '',
    nameCondominium: '',
    statusOwner: '',
    blockName: '',
    unitName: '',
    email: '',
    phone: '',
    intercomCode: '',
    employeeExtensionNumber: '',
  }

  inputData: InputData[] = [
    {
      id: 'condominium_name',
      formParams: 'nameCondominium',
      name: 'Condominium Name',
      disabledInput: true
    },    {
      id: 'status_owner',
      formParams: 'statusOwner',
      name: 'Status',
      disabledInput: true
    },    {
      id: 'block_name',
      formParams: 'blockName',
      name: 'Block',
      disabledInput: true
    },    {
      id: 'unit_name',
      formParams: 'unitName',
      name: 'Unit',
      disabledInput: true
    },    {
      id: 'email_owner',
      formParams: 'email',
      name: 'Email',
      disabledInput: true
    },    {
      id: 'phone_number',
      formParams: 'phone',
      name: 'Contact',
      disabledInput: true
    }
  ]

  squareButton: any[] = [
    {
      name: 'Family',
      src: 'assets/icon/resident-icon/profile/Add User Group Woman Man.webp',
    },    {
      name: 'Employee',
      src: 'assets/icon/resident-icon/profile/Furniture.webp',
    },    {
      name: 'Estate',
      src: 'assets/icon/resident-icon/profile/Home.png',
    },    {
      name: 'Ban',
      src: 'assets/icon/resident-icon/profile/No User.webp',
    },    {
      name: 'Pets',
      src: 'assets/icon/resident-icon/profile/Pets.webp',
    },    {
      name: 'Vehicles',
      src: 'assets/icon/resident-icon/profile/Oncoming Automobile.webp',
    }
  ]

  disabledInput: boolean = true;

  //for estate
  profileEstate: Estate[] = [];
  isLoading: boolean = false;
  activeUnit : number = 0;
  noData: boolean = false;

  //for ban
  historyData: Array<{
    purpose: string;
    visitor_name: string;
    visitor_date: string;
    visitor_entry_time: string;
    visitor_exit_time: string;
    mode_of_entry: string;
    vehicle_number: string;
    point_of_entry: string;
    mobile_number: string;
    visitor_type: string;
    delivery_type: string;
    vehicle_type: string;
    banned: boolean;
    reason_for_banning: string;
    id: number;
  }> = [];

  //for contractor
  filteredData: Array<{
    purpose: string;
    visitor_name: string;
    visitor_date: string;
    visitor_entry_time: string;
    visitor_exit_time: string;
    mode_of_entry: string;
    vehicle_number: string;
    point_of_entry: string;
    mobile_number: string;
    delivery_type: string;
    vehicle_type: string;
    banned: boolean;
    reason_for_banning: string;
    id: number;
  }> = [];

  //for pet
  petList: pet[] = [];

  constructor(
    private webRtcService: WebRtcService,
    public functionMain: FunctionMainService,
    private storage: StorageService,
    private router: Router,
    private mainResident: MainApiResidentService,
    private alertController: AlertController,
    private platform: Platform,
    private fcmTokenService: FcmTokenService
  ) {
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras.state as { from: any };
    if (state) {
      if (state.from === 'detail-history-in-visitor') {
        this.pageName = 'Ban'
        this.showMain = false;
        this.showEstate = false;
        this.showPets = false;
        this.showBanVisitorContractor = true;
        this.getHistoryList();
        if (this.userType) {
          this.getHistoryContrctorList();
        }
      } else if (state.from === 'pets-detail-for-profile') {
        this.pageName = 'My Pets';
        this.showMain = false;
        this.showEstate = false;
        this.showBanVisitorContractor = false;
        this.showPets = true;
        this.loadPet();
      }
    }
  }

  ionViewWillEnter() {
    this.storage.getValueFromStorage('USESATE_DATA').then((value: any) => {
      this.storage.decodeData(value).then((value: any) => {
        if ( value ) {
          const estate = JSON.parse(value) as Estate;
          this.imageProfile = estate.image_profile;
          this.familyId = estate.family_id;
          this.userName = estate.family_name;
          this.userType = estate.record_type;
          if (this.userType === 'industrial') {
            this.inputData = [
              {
                id: 'family_nickname',
                formParams: 'familyNickname',
                name: 'Nickname',
                disabledInput: true
              },    {
                id: 'employee_extension_number',
                formParams: 'employeeExtensionNumber',
                name: 'Employee Extension Number',
                disabledInput: this.disabledInput
              },    {
                id: 'condominium_name',
                formParams: 'nameCondominium',
                name: 'Project Name',
                disabledInput: true
              },    {
                id: 'email_owner',
                formParams: 'email',
                name: 'Email',
                disabledInput: this.disabledInput
              },    {
                id: 'phone_number',
                formParams: 'phone',
                name: 'Contact',
                disabledInput: this.disabledInput
              },
            ]
            this.inputForm = {
              familyNickname: estate.family_nickname,
              nameCondominium: estate.project_name,
              statusOwner: estate.family_type,
              blockName: estate.block_name,
              unitName: estate.unit_name,
              email: estate.family_email,
              phone: estate.family_mobile_number,
              employeeExtensionNumber: estate.employee_extension_number,
              intercomCode: estate.intercom_code
            }
          } else {
            this.inputData = [
              {
                id: 'family_nickname',
                formParams: 'familyNickname',
                name: 'Nickname',
                disabledInput: true
              },    {
                id: 'condominium_name',
                formParams: 'nameCondominium',
                name: 'Condominium Name',
                disabledInput: true
              },    {
                id: 'status_owner',
                formParams: 'statusOwner',
                name: 'Status',
                disabledInput: true
              },    {
                id: 'block_name',
                formParams: 'blockName',
                name: 'Block',
                disabledInput: true
              },    {
                id: 'unit_name',
                formParams: 'unitName',
                name: 'Unit',
                disabledInput: true
              },    {
                id: 'email_owner',
                formParams: 'email',
                name: 'Email',
                disabledInput: this.disabledInput
              },    {
                id: 'phone_number',
                formParams: 'phone',
                name: 'Contact',
                disabledInput: this.disabledInput
              },    {
                id: 'intercom_code',
                formParams: 'intercomCode',
                name: 'Intercom Code',
                disabledInput: this.disabledInput
              }
            ]
            this.inputForm = {
              familyNickname: estate.family_nickname,
              nameCondominium: estate.project_name,
              statusOwner: estate.family_type,
              blockName: estate.block_name,
              unitName: estate.unit_name,
              email: estate.family_email,
              phone: estate.family_mobile_number,
              employeeExtensionNumber: estate.employee_extension_number,
              intercomCode: estate.intercom_code
            }

            console.log(this.inputForm.statusOwner);
            
            if (this.inputForm.statusOwner === 'Helper' || this.inputForm.statusOwner === 'Tenants') {
              console.log("tesj sw");
              this.squareButton = [
                { name: 'Estate', src: 'assets/icon/resident-icon/profile/Home.png' }
              ]; // kosong
            } else {
              console.log("tesj seerw");
              this.squareButton = [
                { name: 'Family', src: 'assets/icon/resident-icon/profile/Add User Group Woman Man.webp' },
                { name: 'Employee', src: 'assets/icon/resident-icon/profile/Furniture.webp' },
                { name: 'Estate', src: 'assets/icon/resident-icon/profile/Home.png' },
                { name: 'Ban', src: 'assets/icon/resident-icon/profile/No User.webp' },
                { name: 'Pets', src: 'assets/icon/resident-icon/profile/Pets.webp' },
                { name: 'Vehicles', src: 'assets/icon/resident-icon/profile/Oncoming Automobile.webp' },
              ];
            }
          }
          if (estate.unit_id) {
            this.activeUnit = estate.unit_id;
          } else {
            this.activeUnit = estate.family_id;
          }
          Preferences.get({key: 'USER_INFO'}).then(async (value) => {
            if(value?.value){
              try {
                const decodedEstateString = decodeURIComponent(escape(atob(value.value)));
                this.isLoading = true;
                // Mengubah string JSON menjadi objek JavaScript
                const credential = JSON.parse(decodedEstateString);
                this.loadEstate(credential.emailOrPhone ? credential.emailOrPhone : (estate.family_email ? estate.family_email : estate.family_mobile_number));
              } catch (error) {
                this.loadEstate(estate.family_email ? estate.family_email : estate.family_mobile_number);
              }
            }
          })
        }
      })
    })
  }

  ngOnInit() {
    
  }

  private routerSubscription!: Subscription;
  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  onChangeTypeUser(event: any) {
    this.userType = event;
    if (event === 'industrial') {
      this.squareButton = [
        {
          name: 'Estate',
          src: 'assets/icon/resident-icon/profile/Home.png',
        },    {
          name: 'Ban',
          src: 'assets/icon/resident-icon/profile/No User.webp',
        },{
          name: 'Vehicles',
          src: 'assets/icon/resident-icon/profile/Oncoming Automobile.webp',
        }
      ];
    }
  }

  ableChangeInput(afterChange?: string) {
    console.log(afterChange);
    
    // Toggle the disabledInput state
    this.disabledInput = !this.disabledInput;
  
    // Update the disabledInput for email and phone fields
    this.inputData.forEach(input => {
      if (input.formParams === 'familyNickname') {
        input.disabledInput = this.disabledInput;
      }
    });
  
    if (this.disabledInput === true) {
      if (afterChange === 'afterEdit') {
        this.functionMain.presentToast('Your data has been change.', 'success');
      } else {
        this.functionMain.presentToast('You can not change your profile data.', 'danger');
      }
      this.storage.getValueFromStorage('USESATE_DATA').then((value: any) => {
        this.storage.decodeData(value).then((value: any) => {
          if ( value ) {
            const estate = JSON.parse(value) as Estate;
            this.imageProfile = estate.image_profile;
            this.familyId = estate.family_id;
            this.userName = estate.family_name;
            this.userType = estate.record_type;
            if (this.userType === 'industrial') {
              this.inputData = [
                {
                  id: 'family_nickname',
                  formParams: 'familyNickname',
                  name: 'Nickname',
                  disabledInput: true
                },    {
                  id: 'employee_extension_number',
                  formParams: 'employeeExtensionNumber',
                  name: 'Employee Extension Number',
                  disabledInput: this.disabledInput
                },    {
                  id: 'condominium_name',
                  formParams: 'nameCondominium',
                  name: 'Project Name',
                  disabledInput: true
                },    {
                  id: 'email_owner',
                  formParams: 'email',
                  name: 'Email',
                  disabledInput: this.disabledInput
                },    {
                  id: 'phone_number',
                  formParams: 'phone',
                  name: 'Contact',
                  disabledInput: this.disabledInput
                }
              ]
              this.inputForm = {
                familyNickname: estate.family_nickname,
                nameCondominium: estate.project_name,
                statusOwner: estate.family_type,
                blockName: estate.block_name,
                unitName: estate.unit_name,
                email: estate.family_email,
                phone: estate.family_mobile_number,
                employeeExtensionNumber: estate.employee_extension_number,
                intercomCode: estate.intercom_code
              }
              this.squareButton = [
                {
                  name: 'Estate',
                  src: 'assets/icon/resident-icon/profile/Home.png',
                },    {
                  name: 'Ban',
                  src: 'assets/icon/resident-icon/profile/No User.webp',
                },{
                  name: 'Vehicles',
                  src: 'assets/icon/resident-icon/profile/Oncoming Automobile.webp',
                }
              ];
            } else {
              this.inputData = [
                {
                  id: 'family_nickname',
                  formParams: 'familyNickname',
                  name: 'Nickname',
                  disabledInput: true
                },    {
                  id: 'condominium_name',
                  formParams: 'nameCondominium',
                  name: 'Condominium Name',
                  disabledInput: true
                },    {
                  id: 'status_owner',
                  formParams: 'statusOwner',
                  name: 'Status',
                  disabledInput: true
                },    {
                  id: 'block_name',
                  formParams: 'blockName',
                  name: 'Block',
                  disabledInput: true
                },    {
                  id: 'unit_name',
                  formParams: 'unitName',
                  name: 'Unit',
                  disabledInput: true
                },    {
                  id: 'email_owner',
                  formParams: 'email',
                  name: 'Email',
                  disabledInput: this.disabledInput
                },    {
                  id: 'phone_number',
                  formParams: 'phone',
                  name: 'Contact',
                  disabledInput: this.disabledInput
                },    {
                  id: 'intercom_code',
                  formParams: 'intercomCode',
                  name: 'Intercom Code',
                  disabledInput: this.disabledInput
                }
              ]
              this.inputForm = {
                familyNickname: estate.family_nickname,
                nameCondominium: estate.project_name,
                statusOwner: estate.family_type,
                blockName: estate.block_name,
                unitName: estate.unit_name,
                email: estate.family_email,
                phone: estate.family_mobile_number,
                employeeExtensionNumber: estate.employee_extension_number,
                intercomCode: estate.intercom_code
              }
              console.log(this.inputForm.statusOwner);
              
              if (this.inputForm.statusOwner === 'Helper' || this.inputForm.statusOwner === 'Tenants') {
                console.log("tesj sw");
                this.squareButton = [
                  { name: 'Estate', src: 'assets/icon/resident-icon/profile/Home.png' }
                ]; // kosong
              } else {
                console.log("tesj seerw");
                this.squareButton = [
                  { name: 'Family', src: 'assets/icon/resident-icon/profile/Add User Group Woman Man.webp' },
                  { name: 'Employee', src: 'assets/icon/resident-icon/profile/Furniture.webp' },
                  { name: 'Estate', src: 'assets/icon/resident-icon/profile/Home.png' },
                  { name: 'Ban', src: 'assets/icon/resident-icon/profile/No User.webp' },
                  { name: 'Pets', src: 'assets/icon/resident-icon/profile/Pets.webp' },
                  { name: 'Vehicles', src: 'assets/icon/resident-icon/profile/Oncoming Automobile.webp' },
                ];
              }
            }
            if (estate.unit_id) {
              this.activeUnit = estate.unit_id;
            } else {
              this.activeUnit = estate.family_id;
            }
            Preferences.get({key: 'USER_INFO'}).then(async (value) => {
              if(value?.value){
                const decodedEstateString = decodeURIComponent(escape(atob(value.value)));
                this.isLoading = true;
                // Mengubah string JSON menjadi objek JavaScript
                const credential = JSON.parse(decodedEstateString);
                this.loadEstate(credential.emailOrPhone);
              }
            })
          }
        })
      })
    } else {
      this.functionMain.presentToast('You can change your profile data now.', 'success');
    }
  }

  isModalChooseUpload: boolean = false;
  chooseWhereToChoose() {
    console.log("tes");
    this.isModalChooseUpload = !this.isModalChooseUpload;
  }

  onUploadImageProfile(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.isModalChooseUpload = !this.isModalChooseUpload;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imageProfile = e.target.result; // Menyimpan URL gambar untuk preview
      };
      reader.readAsDataURL(file); // Membaca file sebagai URL data
      this.functionMain.convertToBase64(file).then((base64: string) => {
        // console.log('Base64 successed');
        this.imageProfile = base64.split(',')[1]; // Update the form control for image file
      }).catch(error => {
        console.error('Error converting to base64', error);
      });
    }
  }

  async openCamera() {
    try {
      // Request camera permissions
      const permissionStatus = await Camera.checkPermissions();
      if (permissionStatus.camera !== 'granted') {
        await Camera.requestPermissions();
      }
      
      const image = await Camera.getPhoto({
        quality: 90,
        // allowEditing: true,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        promptLabelHeader: 'Take a photo',
        promptLabelCancel: 'Cancel',
        promptLabelPhoto: 'Take Photo',
      });
      
      if (image && image.base64String) {
        this.isModalChooseUpload = !this.isModalChooseUpload;
        // Update the form data with the base64 image
        this.imageProfile = image.base64String;
        
        // Update display name to show a camera capture was made
        const timestamp = new Date().toISOString().split('T')[0];
        this.imageProfile = image.base64String;
        
        // Display success message
        this.functionMain.presentToast('Photo captured successfully', 'success');
      }
    } catch (error) {
      console.error('Camera error:', error);
      this.functionMain.presentToast(String(error), 'danger');
    }
  }

  onClickButton(button?: any, type?: string) {
    console.log('Button clicked:', button, 'Type:', type);
    if (type === 'back') {
      this.pageName = '';
      this.showEstate = false;
      this.showMain = true;
      this.showBanVisitorContractor = false;
      this.showPets = false;
      this.historyData.pop();
    }
  }

  onChangeValueInput(value: any, forWhat: string) {
    if (forWhat === 'condominium_name') {
      this.inputForm.nameCondominium = value;
    } else if (forWhat === 'status_owner') {
      this.inputForm.statusOwner = value;
    } else if (forWhat === 'block_name') {
      this.inputForm.blockName = value;
    } else if (forWhat === 'unit_name') {
      this.inputForm.unitName = value;
    } else if (forWhat === 'email_owner') {
      this.inputForm.email = value;
    } else if (forWhat === 'phone_number') {
      this.inputForm.phone = value;
    } else if (forWhat === 'family_nickname') {
      this.inputForm.familyNickname = value;
    }
  }
  
  saveChangeProfile() {
    console.log(this.inputForm, this.imageProfile);
    this.mainResident.endpointMainProcess({
      family_nickname: this.inputForm.familyNickname,
      new_image_profile: this.imageProfile
    }, 'post/change_update_profile_image').subscribe((response: any) => {
      const estateString = JSON.stringify(response.result.new_estate);
      console.log(estateString);
      // Melakukan encoding ke Base64
      const encodedEstate = btoa(unescape(encodeURIComponent(estateString)));
      console.log(encodedEstate);
      this.storage.setValueToStorage('USESATE_DATA', encodedEstate).then((response: any) => {
        this.storage.getValueFromStorage('USESATE_DATA').then((value: any) => {
          this.storage.decodeData(value).then((value: any) => {
            if ( value ) {
              this.webRtcService.initializeSocket();
              const estate = JSON.parse(value) as Estate;
              this.imageProfile = estate.image_profile;
              this.familyId = estate.family_id;
              this.userName = estate.family_name;
              this.userType = estate.record_type;
              if (this.userType === 'industrial') {
                this.inputData = [
                  {
                    id: 'family_nickname',
                    formParams: 'familyNickname',
                    name: 'Nickname',
                    disabledInput: true
                  },    {
                    id: 'employee_extension_number',
                    formParams: 'employeeExtensionNumber',
                    name: 'Employee Extension Number',
                    disabledInput: this.disabledInput
                  },    {
                    id: 'condominium_name',
                    formParams: 'nameCondominium',
                    name: 'Project Name',
                    disabledInput: true
                  },    {
                    id: 'email_owner',
                    formParams: 'email',
                    name: 'Email',
                    disabledInput: this.disabledInput
                  },    {
                    id: 'phone_number',
                    formParams: 'phone',
                    name: 'Contact',
                    disabledInput: this.disabledInput
                  }
                ]
                this.inputForm = {
                  familyNickname: estate.family_nickname,
                  nameCondominium: estate.project_name,
                  statusOwner: estate.family_type,
                  blockName: estate.block_name,
                  unitName: estate.unit_name,
                  email: estate.family_email,
                  phone: estate.family_mobile_number,
                  employeeExtensionNumber: estate.employee_extension_number,
                  intercomCode: estate.intercom_code
                }
              } else {
                this.inputData = [
                  {
                    id: 'family_nickname',
                    formParams: 'familyNickname',
                    name: 'Nickname',
                    disabledInput: true
                  },    {
                    id: 'condominium_name',
                    formParams: 'nameCondominium',
                    name: 'Condominium Name',
                    disabledInput: true
                  },    {
                    id: 'status_owner',
                    formParams: 'statusOwner',
                    name: 'Status',
                    disabledInput: true
                  },    {
                    id: 'block_name',
                    formParams: 'blockName',
                    name: 'Block',
                    disabledInput: true
                  },    {
                    id: 'unit_name',
                    formParams: 'unitName',
                    name: 'Unit',
                    disabledInput: true
                  },    {
                    id: 'email_owner',
                    formParams: 'email',
                    name: 'Email',
                    disabledInput: this.disabledInput
                  },    {
                    id: 'phone_number',
                    formParams: 'phone',
                    name: 'Contact',
                    disabledInput: this.disabledInput
                  },    {
                    id: 'intercom_code',
                    formParams: 'intercomCode',
                    name: 'Intercom Code',
                    disabledInput: this.disabledInput
                  }
                ]
                this.inputForm = {
                  familyNickname: estate.family_nickname,
                  nameCondominium: estate.project_name,
                  statusOwner: estate.family_type,
                  blockName: estate.block_name,
                  unitName: estate.unit_name,
                  email: estate.family_email,
                  phone: estate.family_mobile_number,
                  employeeExtensionNumber: estate.employee_extension_number,
                  intercomCode: estate.intercom_code
                }
              }
              if (estate.unit_id) {
                this.activeUnit = estate.unit_id;
              } else {
                this.activeUnit = estate.family_id;
              }
              Preferences.get({key: 'USER_INFO'}).then(async (value) => {
                if(value?.value){
                  const decodedEstateString = decodeURIComponent(escape(atob(value.value)));
                  this.isLoading = true;
                  // Mengubah string JSON menjadi objek JavaScript
                  const credential = JSON.parse(decodedEstateString);
                  this.loadEstate(credential.emailOrPhone);
                }
              })
            }
          })
        })
        this.ableChangeInput('afterEdit');
      })
    })
  }

  onClickSquareBottom(event: any) {
    if (event[1] === 'Ban') {
      this.content.scrollToTop(300); // 300 adalah durasi animasi dalam milidetik
      this.pageName = 'Ban';
      this.showMain = false;
      this.showEstate = false;
      this.showPets = false;
      this.showBanVisitorContractor = true;
      this.getHistoryList();
      if (this.userType === 'industrial') {
        this.getHistoryContrctorList();
      }
    } else if (event[1] === 'Family') {
      this.router.navigate(['/family-page-main'], {
        state: {
          from: "family",
        }
      });
    } else if (event[1] === 'Vehicles') {
      this.router.navigate(['/my-vehicle-page-main'], {
        state: {
          from: "profile",
        }
      });
    } else if (event[1] === 'Employee') {
      this.router.navigate(['/family-page-main'], {
        state: {
          from: "helper",
        }
      });
    } else if (event[1] === 'Estate') {
      this.content.scrollToTop(300); // 300 adalah durasi animasi dalam milidetik
      this.pageName = 'Choose Estate';
      this.showMain = false;
      this.showPets = false;
      this.showBanVisitorContractor = false;
      this.showEstate = true;
    } else if (event[1] === 'Pets') {
      this.content.scrollToTop(300); // 300 adalah durasi animasi dalam milidetik
      this.pageName = 'My Pets';
      this.showMain = false;
      this.showEstate = false;
      this.showBanVisitorContractor = false;
      this.showPets = true;
      this.loadPet();
    }
  }

  loadEstate(email:string) {
    this.mainResident.endpointProcess({
      email: email,
    }, 'get/estate').subscribe(
      response => {
        if (response.result.status_code === 200) {
          var listedEstate = []
          for (var key in response.result.response){
            if(response.result.response.hasOwnProperty(key)){
              listedEstate.push({
                user_id: response.result.response[key]?.user_id,
                family_id: response.result.response[key]?.family_id,
                family_name: response.result.response[key]?.family_name || '',
                employee_extension_number: response.result.response[key]?.employee_extension_number || '',
                family_nickname: response.result.response[key]?.family_nickname || '',
                image_profile: response.result.response[key]?.image_profile || '',
                family_email: response.result.response[key]?.family_email || '',
                family_mobile_number: response.result.response[key]?.family_mobile_number || '',
                family_type: response.result.response[key]?.family_type || '',
                unit_id: response.result.response[key]?.unit_id,
                unit_name: response.result.response[key]?.unit_name || '',
                block_id: response.result.response[key]?.block_id,
                block_name: response.result.response[key]?.block_name || '',
                project_id: response.result.response[key]?.project_id,
                project_name: response.result.response[key]?.project_name || '',
                project_image: response.result.response[key]?.project_image || '',
                record_type: response.result.response[key]?.record_type || '',
                intercom_code: response.result.response[key]?.intercom_code || ''
              })
            }
          }
          this.profileEstate = listedEstate;
          this.isLoading = false;
        } else {
          console.error('Error fetching Estate:', response);
        }
      },
      error => {
        console.error('HTTP Error:', error);
      }
    );
  }

  async getAccessToken(familyId: number, client?: string) {
    this.mainResident.endpointCustomProcess({
      previous_family_id: this.familyId,
      family_id: familyId,
    }, '/get/access_token').subscribe({
      next: (response: any) => {
        if (response.result.status_code === 200) {
          Preferences.clear();
          if (response.result.email) {
            const userCredentials = {
              emailOrPhone: response.result.email,
              access_token: response.result.access_token
            }
            Preferences.set({
              key: 'USER_INFO',
              value: btoa(unescape(encodeURIComponent(JSON.stringify(userCredentials))))
            })
          } else {
            this.router.navigate(['/client-main-app'], {queryParams: {reload: true}});
            Preferences.set({
              key: 'USER_INFO',
              value: response.result.access_token,
            })
          }
        }
      },
      error: (error) => {
        console.error('Failed to get access token:', error);
      }
    });
  }

  async chooseEstateClick(estate: any) {
    if (estate.user_id) {
      let storageData = {
        'image_profile': estate.image_profile
      }
      this.storage.clearAllValueFromStorage();
      this.storage.setValueToStorage('USESATE_DATA', storageData)
      await this.getNotificationPermission(estate.family_id).then(() => {
        this.getAccessToken(estate.family_id, 'client');
      });
      // this.router.navigate(['/client-main-app'], {queryParams: {reload: true}});
      return;
    } else {
      // Mengubah estate menjadi string JSON
      const estateString = JSON.stringify(estate);
      await this.getNotificationPermission(estate.family_id);
      console.log("YO PING 1")

      await this.getAccessToken(estate.family_id);
      console.log("YO PING 2")

      // Melakukan encoding ke Base64
      const encodedEstate = btoa(unescape(encodeURIComponent(estateString)));
      this.storage.setValueToStorage('USESATE_DATA', encodedEstate).then((response: any) => {
        this.storage.getValueFromStorage('USESATE_DATA').then((value: any) => {
          this.storage.decodeData(value).then((value: any) => {
            if ( value ) {
              this.webRtcService.initializeSocket();
              const estate = JSON.parse(value) as Estate;
              this.imageProfile = estate.image_profile;
              this.familyId = estate.family_id;
              this.userName = estate.family_name;
              this.userType = estate.record_type;
              if (this.userType === 'industrial') {
                this.inputData = [
                  {
                    id: 'family_nickname',
                    formParams: 'familyNickname',
                    name: 'Nickname',
                    disabledInput: true
                  },    {
                    id: 'employee_extension_number',
                    formParams: 'employeeExtensionNumber',
                    name: 'Employee Extension Number',
                    disabledInput: this.disabledInput
                  },    {
                    id: 'condominium_name',
                    formParams: 'nameCondominium',
                    name: 'Project Name',
                    disabledInput: true
                  },    {
                    id: 'email_owner',
                    formParams: 'email',
                    name: 'Email',
                    disabledInput: this.disabledInput
                  },    {
                    id: 'phone_number',
                    formParams: 'phone',
                    name: 'Contact',
                    disabledInput: this.disabledInput
                  }
                ]
                this.inputForm = {
                  familyNickname: estate.family_nickname,
                  nameCondominium: estate.project_name,
                  statusOwner: estate.family_type,
                  blockName: estate.block_name,
                  unitName: estate.unit_name,
                  email: estate.family_email,
                  phone: estate.family_mobile_number,
                  employeeExtensionNumber: estate.employee_extension_number,
                  intercomCode: estate.intercom_code
                }
                this.squareButton = [
                  {
                    name: 'Estate',
                    src: 'assets/icon/resident-icon/profile/Home.png',
                  },    {
                    name: 'Ban',
                    src: 'assets/icon/resident-icon/profile/No User.webp',
                  },{
                    name: 'Vehicles',
                    src: 'assets/icon/resident-icon/profile/Oncoming Automobile.webp',
                  }
                ];
              } else {
                this.inputData = [
                  {
                    id: 'family_nickname',
                    formParams: 'familyNickname',
                    name: 'Nickname',
                    disabledInput: true
                  },    {
                    id: 'condominium_name',
                    formParams: 'nameCondominium',
                    name: 'Condominium Name',
                    disabledInput: true
                  },    {
                    id: 'status_owner',
                    formParams: 'statusOwner',
                    name: 'Status',
                    disabledInput: true
                  },    {
                    id: 'block_name',
                    formParams: 'blockName',
                    name: 'Block',
                    disabledInput: true
                  },    {
                    id: 'unit_name',
                    formParams: 'unitName',
                    name: 'Unit',
                    disabledInput: true
                  },    {
                    id: 'email_owner',
                    formParams: 'email',
                    name: 'Email',
                    disabledInput: this.disabledInput
                  },    {
                    id: 'phone_number',
                    formParams: 'phone',
                    name: 'Contact',
                    disabledInput: this.disabledInput
                  },    {
                    id: 'intercom_code',
                    formParams: 'intercomCode',
                    name: 'Intercom Code',
                    disabledInput: this.disabledInput
                  }
                ]
                this.inputForm = {
                  familyNickname: estate.family_nickname,
                  nameCondominium: estate.project_name,
                  statusOwner: estate.family_type,
                  blockName: estate.block_name,
                  unitName: estate.unit_name,
                  email: estate.family_email,
                  phone: estate.family_mobile_number,
                  employeeExtensionNumber: estate.employee_extension_number,
                  intercomCode: estate.intercom_code
                }
                console.log(this.inputForm.statusOwner);
                
                if (this.inputForm.statusOwner === 'Helper' || this.inputForm.statusOwner === 'Tenants') {
                  console.log("tesj sw");
                  this.squareButton = [
                    { name: 'Estate', src: 'assets/icon/resident-icon/profile/Home.png' }
                  ]; // kosong
                } else {
                  console.log("tesj seerw");
                  this.squareButton = [
                    { name: 'Family', src: 'assets/icon/resident-icon/profile/Add User Group Woman Man.webp' },
                    { name: 'Employee', src: 'assets/icon/resident-icon/profile/Furniture.webp' },
                    { name: 'Estate', src: 'assets/icon/resident-icon/profile/Home.png' },
                    { name: 'Ban', src: 'assets/icon/resident-icon/profile/No User.webp' },
                    { name: 'Pets', src: 'assets/icon/resident-icon/profile/Pets.webp' },
                    { name: 'Vehicles', src: 'assets/icon/resident-icon/profile/Oncoming Automobile.webp' },
                  ];
                }
              }
              if (estate.unit_id) {
                this.activeUnit = estate.unit_id;
              } else {
                this.activeUnit = estate.family_id;
              }
              Preferences.get({key: 'USER_INFO'}).then(async (value) => {
                if(value?.value){
                  const decodedEstateString = decodeURIComponent(escape(atob(value.value)));
                  this.isLoading = true;
                  // Mengubah string JSON menjadi objek JavaScript
                  const credential = JSON.parse(decodedEstateString);
                  this.loadEstate(credential.emailOrPhone);
                }
              })
            }
          })
          this.showEstate = false;
          this.showMain = true;
        })
        if (estate.unit_id) {
          this.activeUnit = estate.unit_id;
        } else {
          this.activeUnit = estate.family_id;
        }
      })
    }
  }

  fcmToken: string = '';

  async getNotificationPermission(familyId: number): Promise<string> {
    try {
      if (typeof PushNotifications === 'undefined') {
        console.warn('PushNotifications not available.');
        return '';
      }

      const permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted') {
        console.log('Notification permission not granted');
        return '';
      }

      // ✅ Use FcmTokenService which correctly returns Firebase FCM token on iOS
      const token = await this.fcmTokenService.getToken(15000);
      if (!token) {
        console.warn('FCM token could not be retrieved');
        return '';
      }

      this.fcmToken = token;
      console.log('FCM Token received:', token);

      this.mainResident.endpointCustomProcess({
        previous_family_id: this.familyId,
        family_id: familyId,
        fcm_token: token,
        device_new: Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'
      }, '/set/fcm_token').subscribe({
        next: (response: any) => console.log('FCM token sent to backend:', response),
        error: (error: any) => console.error('Failed to send FCM token to backend:', error)
      });

      return token;
    } catch (err) {
      console.error('Push Notification Error:', err);
      return '';
    }
  }

  getHistoryList() {
    this.isLoading = true;
    this.historyData = [];
    this.historyData.pop();
    this.mainResident.endpointMainProcess({}, 'get/visitor_history').subscribe((response) => {
      var result = response.result['response_result']
      this.historyData = []
      if (response.result.response_status === 400) {
        this.isLoading = false;
        return;
      } else {
        const bannedItems = result.filter((item: any) => item['is_banned'] === true);
        
        bannedItems.forEach((item: any) => {
          const [entryHours, entryMinutes] = item['entry_time'].split(':').map(Number);
          const entryDate = new Date();
          entryDate.setHours(entryHours, entryMinutes, 0, 0); 
          entryDate.setHours(entryDate.getHours() + 1);
          const exitTime = `${entryDate.getHours().toString().padStart(2, '0')}:${entryDate.getMinutes().toString().padStart(2, '0')}`;
          const visitDate = item['visit_date'] ? item['visit_date'] : new Date();
          const dateParts = visitDate.split('-'); // Misalnya, '2023-10-15' menjadi ['2023', '10', '15']
          const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
      
          this.historyData.push({
            purpose: item['purpose'],
            visitor_name: item['visitor_name'],
            visitor_date: item['visit_date'] ? item['visit_date'] : new Date(),
            visitor_entry_time: item['entry_time'],
            visitor_exit_time: exitTime,
            mode_of_entry: item['mode_of_entry'],
            visitor_type: item['visitor_type'],
            vehicle_number: item['vehicle_number'],
            point_of_entry: item['point_of_entry'],
            mobile_number: item['contact_number'],
            delivery_type: item['delivery_type'],
            vehicle_type: item['vehicle_type'],
            banned: item['is_banned'],
            reason_for_banning: item['reason_for_banning'],
            id: item['visitor_id']
          });
          console.log(this.historyData);
          
          this.isLoading = false;
        });
      }
    })
  }

  openDetails(historyData: any) {
    this.router.navigate(['/detail-history-in-visitor'], {
      state: {
        historyData: historyData,
        from: 'profile'
      }
    });
  }

  public async showAlertButtons(headerName: string, className: string, historyData: any) {
    const alertButtons = await this.alertController.create({
      cssClass: className,
      header: headerName + " this visitor?",
      buttons: [
        {
          text: 'Confirm',
          role: 'confirm',
          handler: () => {
            this.reinstateProcess(historyData);
            // console.log(historyData);
          },
        },
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => {
            console.log('Alert cancel');
          },
        },
      ]
    });
    await alertButtons.present ();
  }

  reinstateProcess(historyData: any) {
    console.log("tes");
    this.mainResident.endpointMainProcess({
      contact_no: historyData.mobile_number,
      vehicle_number: historyData.vehicle_number
    }, 'post/reinstate_visitor').subscribe(
      (response) => {
        console.log('Success:', response);
        // this.router.navigate(['resident-my-profile']);
        this.getHistoryList();
        this.getHistoryContrctorList();
      },
    )
  }

  getHistoryContrctorList() {
    this.isLoading = true;
    this.filteredData = [];
    this.filteredData.pop();
    this.mainResident.endpointMainProcess({}, 'get/contractor_history').subscribe((response) => {
      this.isLoading = true; // Set loading to true at the start
      var result = response.result['response_result'];
      
      if (response.result.response_status === 400) {
        this.isLoading = false;
        return;
      } else {
        const bannedItems = result.filter((item: any) => item['is_banned'] === true);

        bannedItems.forEach((item: any) => {
          const [entryHours, entryMinutes] = item['entry_time'].split(':').map(Number);
          const entryDate = new Date();
          entryDate.setHours(entryHours, entryMinutes, 0, 0); 
          entryDate.setHours(entryDate.getHours() + 1);
          const exitTime = `${entryDate.getHours().toString().padStart(2, '0')}:${entryDate.getMinutes().toString().padStart(2, '0')}`;
          
          const visitDate = item['visit_date'] ? item['visit_date'] : new Date();
          const dateParts = visitDate.split('-'); // Misalnya, '2023-10-15' menjadi ['2023', '10', '15']
          const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
  
          this.filteredData.push({
            purpose: item['purpose'],
            visitor_name: item['contractor_name'],
            visitor_date: formattedDate, // Use formattedDate here
            visitor_entry_time: item['entry_time'],
            visitor_exit_time: exitTime,
            mode_of_entry: item['mode_of_entry'],
            vehicle_number: item['vehicle_number'],
            point_of_entry: item['point_of_entry'],
            mobile_number: item['contact_number'],
            delivery_type: item['delivery_type'],
            vehicle_type: item['vehicle_type'],
            banned: item['is_banned'],
            reason_for_banning: item['reason_for_banning'],
            id: item['contractor_id']
          });
        });
      }
      this.isLoading = false; // Set loading to false after processing all items
    });
  }

  loadPet() {
    this.petList = [];
    this.mainResident.endpointMainProcess({}, 'get/pet_registration').subscribe((response: any) => {
      if (response) {
        if (response.result.status === "success") {
          this.petList = response.result.data.map((pet: pet) => ({
            id: pet.id,
            notes: pet.notes,
            pet_breed: pet.pet_breed,
            pet_image: pet.pet_image,
            type_of_pet: pet.type_of_pet,
            upload_license: pet.upload_license,
          }));
        } else {
          this.functionMain.presentToast('Maybe you dont have a registered pet or not approved yet.', 'danger');
        }
        // console.log(response);
      } else {
        this.functionMain.presentToast('Failed to load pet data', 'danger');
      }
    })
  }

  async deletePets(petID: number) {
    const alert = await this.alertController.create({
      cssClass: 'manage-payment-alert',
      header: 'Delete Pet',
      message: 'Are you sure you want to delete this pet?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass:'secondary',
          handler: (blah) => {
            // console.log('Confirm Cancel: blah', blah);
          }
        }, {
          text: 'Delete',
          handler: () => {
            this.deletePetsProses(petID);
          }
        }
      ]
    });
    await alert.present();
  }

  deletePetsProses(petId: number) {
    this.mainResident.endpointMainProcess({
      pet_id: petId,
    }, 'delete/pet_registration').subscribe((response: any) => {
      if (response) {
        if (response.result.status === "success") {
          this.pageName = 'My Pets';
          this.showMain = false;
          this.showEstate = false;
          this.showBanVisitorContractor = false;
          this.showPets = true;
          this.loadPet();
        } else {
          this.functionMain.presentToast('Failed to delete pet data', 'danger');
        }
        // console.log(response);
      } else {
        this.functionMain.presentToast('Failed to load pet data', 'danger');
      }
    })
  }

  navigateToDetailpets(pet: any) {
    this.router.navigate(['pets-detail-for-profile'], {
      state: {
        pet: pet
      }
    })
  }

  toWhere() {
    this.router.navigate(['/form-for-registration-pet'], {
      state: {
        from: 'profile'
      }
    })
  }

}
