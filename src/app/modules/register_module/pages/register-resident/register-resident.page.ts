import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalController } from '@ionic/angular';

import { FunctionMainService } from 'src/app/service/function/function-main.service';
import { BlockUnitService } from 'src/app/service/global/block_unit/block-unit.service';
import { MainApiResidentService } from 'src/app/service/resident/main/main-api-resident.service';
import { RegisterService } from 'src/app/service/resident/register-resident/register.service';
import { LoadingAnimationComponent } from 'src/app/shared/resident-components/loading-animation/loading-animation.component';

@Component({
  selector: 'app-register-resident',
  templateUrl: './register-resident.page.html',
  styleUrls: ['./register-resident.page.scss'],
})
export class RegisterResidentPage implements OnInit {

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private functionMain: FunctionMainService,
    private blockUnitService: BlockUnitService,
    private RegisterService: RegisterService,
    private modalController: ModalController,
    private mainApiResidentService: MainApiResidentService
  ) { }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params ) {
        if (params['projectId']){
          this.project_id = params['projectId']
          this.loadBlock();
        }else{
          this.functionMain.presentToast('The Chosen Project from previous page has failed to load here', 'danger')
        }
      }else{
        this.functionMain.presentToast('The Chosen Project from previous page has failed to load here', 'danger')
      }
    })

    this.mainApiResidentService.endpointCustomProcess({}, '/fs-get-country-code').subscribe((value: any) => {
      if (value && value.result.country_code_data.length > 0) {
        this.countryCodes = value.result.country_code_data.map((value: any) => {
          return {
            country: value.country,
            code: value.code,
            minDigit: value.min_digit,
            maxDigit: value.max_digit,
          }
        }).sort((a: any, b: any) => {
          if (a.country === 'SG') return -1;
          if (b.country === 'SG') return 1;
          return a.country.localeCompare(b.country); // urutan alfabetis untuk yang lain
        });
        console.log(JSON.stringify(this.countryCodes));
      }
    })
  }

  Block: any[] = [];
  Unit: any[] = [];
  project_id: number = 0;
  isErrorNumber: Boolean = false;

  formData = {
    full_name: '',
    nickname: '',
    email_address: '',
    mobile_number: '',
    block: '',
    unit: '',
    family_type: ''
  };

  countryCodes: any[] = []
  selectedCode: string = '65';

  onFamilyTypeChange(event: any) {
    this.formData.family_type = event.target.value;
  }

  onBlockChange(event: any) {
    this.formData.block = event.target.value;
    this.loadUnit(); // Panggil method load unit
  }

  onUnitChange(event: any) {
    this.formData.unit = event.target.value;
  }

  checkValidNum(event: string){
    const country = this.countryCodes.find(c => c.code === this.selectedCode)
    const value = event
    if (value === '') {
      this.isErrorNumber = true
      this.functionMain.presentToast('Mobile Number is required!', 'danger')
    } else if (value.length < country.minDigit) {
      this.isErrorNumber = true
      this.functionMain.presentToast('Mobile Number should be atleast ' + country.minDigit + ' digit!', 'danger')
    } else if (value.length > country.maxDigit) {
      this.isErrorNumber = true
      this.functionMain.presentToast('Mobile Number must not exceed ' + country.maxDigit + ' digit!', 'danger')
    }
    else {
      this.isErrorNumber = false
    }
  }

  loadBlock() {
    this.blockUnitService.getBlockRegister(this.project_id).subscribe({
      next: (response: any) => {
        if (response.result.status_code === 200) {
          this.Block = response.result.result;
        } else {
          this.functionMain.presentToast('An error occurred while loading block data!', 'danger');
        }
      },
      error: (error) => {
        this.functionMain.presentToast('An error occurred while loading block data!', 'danger');
        console.error('Error:', error);
      }
    });
  }

  async loadUnit() {
    this.formData.unit = ''
    this.blockUnitService.getUnit(this.formData.block).subscribe({
      next: (response: any) => {
        if (response.result.status_code === 200) {
          this.Unit = response.result.result;
        } else {
          this.functionMain.presentToast('An error occurred while loading unit data', 'danger');
          console.error('Error:', response.result);
        }
      },
      error: (error) => {
        this.functionMain.presentToast('An error occurred while loading unit data', 'danger');
        console.error('Error:', error.result);
      }
    });
  }

  onCountryCodeChange(event: any): void {
    console.log(event)
    this.selectedCode = event.target.value;
    this.checkValidNum(this.formData.mobile_number)
  }

  onChangeMobileNumber(event: any) {
    const value = event.target.value
    this.checkValidNum(value)
    if (this.isErrorNumber === false) {
      this.formData.mobile_number = event.target.value
    }
  }

  async onSubmitRegister() {
    if (this.isErrorNumber){
      this.functionMain.presentToast('Please enter a valid Mobile Number!', 'danger')
      return;
    }

    console.log(this.formData)
    let errMsg = ""
    if (!this.formData.full_name) {
      errMsg += 'Full Name is required!\n';
    }
    if (!this.formData.mobile_number && !this.formData.email_address) {
      errMsg += 'Mobile Number or Email Address is required!\n';
    }
    if (!this.formData.block || !this.formData.unit) {
      errMsg += 'Block and unit must be selected!\n';
    }
    if (errMsg != "") {
      this.functionMain.presentToast(errMsg, 'danger')
      return
    }
    // console.log(this.formData, this.selectedCode)
    try {
      console.log(this.formData, `${this.selectedCode}${this.formData.mobile_number}`);

      let modalRef: HTMLIonModalElement | null = null;
      modalRef = await this.modalController.create({
        component:LoadingAnimationComponent,
        cssClass: 'modal-loading',
      });
      await modalRef.present();
      
      this.RegisterService.postRegister(this.formData.full_name, this.formData.nickname, this.formData.email_address, `${this.selectedCode}${this.formData.mobile_number}`, this.formData.block, this.formData.unit, this.formData.family_type).subscribe(
        res => {
          if (res.result.status_code == 200) {
            this.formData = {
              full_name: '',
              nickname: '',
              email_address: '',
              mobile_number: '',
              block: '',
              unit: '',
              family_type: ''
            };
            modalRef.dismiss();

            this.router.navigate(['login-end-user'])
            this.functionMain.presentToast('Please wait for approval', 'success');
          } else {
            this.functionMain.presentToast(res.result.status_desc, 'danger');
            modalRef.dismiss();
            console.log(res.result);
          }

        },
        error => {
          console.error('Error Here:', error);
          this.functionMain.presentToast('An unexpected error has occurred!', 'danger');
        }
      );
    } catch (error) {
      console.error('Unexpected error:', error);
      this.functionMain.presentToast('An unexpected error has occurred!', 'danger');
    }

  }
}
