import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { trigger, style, animate, transition } from '@angular/animations';
import { ActivatedRoute, Router } from '@angular/router';

import { MainApiResidentService } from 'src/app/service/resident/main/main-api-resident.service';
import { FunctionMainService } from 'src/app/service/function/function-main.service';
import { StorageService } from 'src/app/service/storage/storage.service';

@Component({
  selector: 'app-app-report-main',
  templateUrl: './app-report-main.page.html',
  styleUrls: ['./app-report-main.page.scss'],
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
export class AppReportMainPage implements OnInit {

  isLoading: boolean = false;
  fromWhere: string = '';
  navButtons: any[] = [
    {
      text: 'Reported Issues',
      active: true,
      action: 'click'
    },
    {
      text: 'Report an Issue',
      active: false,
      action: 'click'
    },
  ]

  showBackButton: boolean = false;
  showRecord: boolean = true;
  showForm: boolean = false;

  reporterDetailsFrom = {
    requestorId: 0,
    blokId: 0,
    unitId: 0,
    name: '',
    contactNumber: '',
    email: '',
    blockAndUnit: '',
    placeOfResidence: '',
    typeReport: 0,
    summaryReport: '',
    ticketAttachment: '',
  };
  extend_mb = false
  typeOfReport: any = []

  isReportApp: string = '1';
  allData: any = [];

  pageName: string = '';
  subPageName: string = '';

  pagination = {
    current_page: 1,    // Changed to number with default value
    per_page: 10,       // Changed to number with default value
    total_page: 1,      // Changed to number with default value
    total_records: 0    // Changed to number with default value
  }

  constructor(
    private router: Router,
    private mainApi: MainApiResidentService,
    public functionMain: FunctionMainService,
    private storage: StorageService,
    private route: ActivatedRoute,
  ) {  }

  handleRefresh(event: any) {
    this.isLoading = true;
    if (this.fromWhere === 'setting-app-report') {
      setTimeout(() => {
        this.pageName = 'Report App Issue';
        this.loadTicketFromBackendFor(this.fromWhere);
        this.loadTypeFor(this.fromWhere);
        event.target.complete();
        this.showBackButton = true;
        this.showRecord = false;
        this.showForm = true;
        this.navButtons[0].active = false;
        this.navButtons[1].active = true;
        this.subPageName = 'Report Form'
      }, 1000)
    } else if (this.fromWhere === 'app-report'){
      setTimeout(() => {
        this.pageName = 'Report App Issue';
        this.loadTicketFromBackendFor(this.fromWhere);
        this.loadTypeFor(this.fromWhere);
        event.target.complete();
        }, 1000)
    } else {
      setTimeout(() => {
        this.pageName = 'Report Issue';
        this.loadTicketFromBackendFor(this.fromWhere);
        this.loadTypeFor(this.fromWhere);
        event.target.complete();
      }, 1000)
    }
  }

  ngOnInit() {
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras.state as { fromWhere: string };
    if (state) {
      this.fromWhere = state.fromWhere;
      if (this.fromWhere === 'setting-app-report') {
        this.pageName = 'Report App Issue';
        this.loadTicketFromBackendFor(this.fromWhere);
        this.loadTypeFor(this.fromWhere);
        this.showBackButton = true;
        this.showRecord = false;
        this.showForm = true;
        this.navButtons[0].active = false;
        this.navButtons[1].active = true;
        this.subPageName = 'Report Form'
      } else if (this.fromWhere === 'app-report'){
        this.pageName = 'Report App Issue';
        this.loadTicketFromBackendFor(this.fromWhere);
        this.loadTypeFor(this.fromWhere);
      } else {
        this.pageName = 'Report Issue';
        this.loadTicketFromBackendFor(this.fromWhere);
        this.loadTypeFor(this.fromWhere);
      }
    }
    this.storage.getValueFromStorage('USESATE_DATA').then((value: any) => {
      this.storage.decodeData(value).then((value: any) => {
        if ( value ) {
          const estate = JSON.parse(value);
          this.reporterDetailsFrom = {
            requestorId: estate.family_id,
            blokId: estate.block_id,
            unitId: estate.unit_id,
            name: estate.family_name,
            contactNumber: estate.family_mobile_number,
            email: estate.family_email,
            blockAndUnit: estate.block_name + ', ' + estate.unit_name,
            placeOfResidence: estate.project_name,
            typeReport: 0,
            summaryReport: '',
            ticketAttachment: '',
          };
          this.record_type = estate.record_type;
        }
      })
    })
    this.route.queryParams.subscribe(params => {
      console.log(params)
      if (params) {
        if (params['reload']){
          this.loadTicketFromBackendFor(this.fromWhere);
        }
      }
    })
  }

  record_type = 'residential'

  onBack(toWhere?: string) {
    if (this.showBackButton === true) {
      this.showBackButton = false;
      this.showForm = false;
      this.showRecord = true;
      this.navButtons[0].active = true;
      this.navButtons[1].active = false;
      this.allData = [];
      this.loadTicketFromBackendFor(this.fromWhere);
      this.typeOfReport = [];
      this.loadTypeFor(this.fromWhere);
      this.subPageName = '';
    } else {
      this.router.navigate(['/resident-home-page'])
    }
  }

  onClick(event: any) {
    if (event[1] === 'Report an Issue') {
      this.showBackButton = true;
      this.showRecord = false;
      this.showForm = true;
      this.navButtons[0].active = false;
      this.navButtons[1].active = true;
      this.subPageName = 'Report Form'
    } else {
      this.showBackButton = true;
      this.showRecord = false;
      this.showForm = true;
      this.navButtons[0].active = false;
      this.navButtons[1].active = true;
      this.subPageName = 'Report Form'
    }
  }

  loadTypeFor(whoIsThis: string) {
    console.log('tes');
    if (whoIsThis === 'app-report') {
      this.mainApi.endpointMainProcess({}, 'get/report_app_type_of_issues').subscribe((response: any) => {
        this.typeOfReport = response.result.result;
      })
    } else {
      this.mainApi.endpointMainProcess({}, 'get/report_condo_type_of_issue').subscribe((response: any) => {
        this.typeOfReport = response.result.result;
      })
    }
  }

  onTypeReportChange(event: any){
    // // console.log(event.target.value);
    const type = event.target.value;
    this.reporterDetailsFrom.typeReport = parseInt(type);
  }

  onSubmit() {
    let errMsg = ''
    if (!this.reporterDetailsFrom.typeReport && this.fromWhere !== 'app-report') {
      errMsg += 'Type of issue is required! \n'
    }
    if (!this.reporterDetailsFrom.summaryReport) {
      errMsg += 'Summary is required! \n'
    }
    if (errMsg) {
      this.functionMain.presentToast(errMsg, 'danger')
      return
    }
    this.mainApi.endpointMainProcess({
      type_of_issue: this.reporterDetailsFrom.typeReport,
      requestor_id: this.reporterDetailsFrom.requestorId,
      summary: this.reporterDetailsFrom.summaryReport,
      ir_attachments: this.reporterDetailsFrom.ticketAttachment,
    }, 'post/report_issue').subscribe((response: any) => {
      // // console.log(response);
      if (response.result.response_code === 200) {
        this.showBackButton = false;
        this.showForm = false;
        this.showRecord = true;
        this.navButtons[0].active = true;
        this.navButtons[1].active = false;
        this.loadTicketFromBackendFor(this.fromWhere);
        this.loadTypeFor(this.fromWhere);
        this.ngOnInit();
      } else {
        // this.presentToast(response.result.message, 'danger');
      }
    })
  }

  testAddMb(status: boolean = false) {
    this.extend_mb = status
  }

  goToPage(event: any, want?: string) {
    const inputValue = parseInt(event.target.value, 10);
    
    // Validate input: ensure it's a number within valid range
    if (!isNaN(inputValue) && inputValue >= 1 && inputValue <= this.pagination.total_page) {
      this.loadTicketFromBackendFor(this.fromWhere, 'goto', inputValue);
    } else {
      // Reset to current page if invalid input
      event.target.value = this.pagination.current_page;
      
      // Optional: Show a toast message for invalid page
      this.functionMain.presentToast('Please enter a valid page number between 1 and ' + this.pagination.total_page, 'warning');
    }
  }

  loadTicketFromBackendFor(whoIsThis: string, type?: string, page?: number) {
    this.allData = []
    this.allData.pop()
    this.isLoading = true
    if (whoIsThis === 'app-report') {
      this.mainApi.endpointMainProcess({
        is_report_app: this.isReportApp,
        is_report_condo: '',
        page: page
      }, 'get/report_issue').subscribe((response: any) => {
        // console.log(response);
        if (response.result.response_code === 200) {
          this.allData = response.result.result;
          this.isLoading = false

          this.pagination = {
            current_page: response.result.pagination.current_page ? Number(response.result.pagination.current_page) : 1,
            per_page: response.result.pagination.per_page ? Number(response.result.pagination.per_page) : 10,
            total_page: response.result.pagination.total_pages ? Number(response.result.pagination.total_pages) : 1,
            total_records: response.result.pagination.total_records ? Number(response.result.pagination.total_records) : 0
          }
          // this.presentToast(response.result.message, 'success');
        } else {
          this.isLoading = false
          // this.presentToast(response.result.error_message, 'danger');
        }
      }, ((error: any) => {
        this.isLoading = false;
        this.functionMain.presentToast('Failed to load data. Please try again later.', 'danger');
      }))
    } else {
      this.mainApi.endpointMainProcess({
        is_report_app: '',
        is_report_condo: this.isReportApp,
      }, 'get/report_issue').subscribe((response: any) => {
        // console.log(response);
        if (response.result.response_code === 200) {
          this.allData = response.result.result;
          this.isLoading = false

          this.pagination = {
            current_page: response.result.pagination.current_page ? Number(response.result.pagination.current_page) : 1,
            per_page: response.result.pagination.per_page ? Number(response.result.pagination.per_page) : 10,
            total_page: response.result.pagination.total_pages ? Number(response.result.pagination.total_pages) : 1,
            total_records: response.result.pagination.total_records ? Number(response.result.pagination.total_records) : 0
          }
          // this.presentToast(response.result.message, 'success');
        } else {
          this.isLoading = false
          // this.presentToast(response.result.error_message, 'danger');
        }
      })
    }
  }

  seeDetail(ticket: any) {
    if (this.fromWhere === 'condo-report') {
      this.router.navigate(['/issue-app-detail-new'], {
        state: {
          ticketDetail: ticket,
          fromWhere: 'fromCondo'
        }
      });
    } else {
      this.router.navigate(['/issue-app-detail-new'], {
        state: {
          ticketDetail: ticket,
        }
      });
    }
    // // console.log(ticket);
  }

  @ViewChild('clientIssueNewAttachment') fileInput!: ElementRef;
  openFileInput() {
    this.fileInput?.nativeElement.click();
  }
  fileName = ''

  selectedFile: File | null = null;
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      console.log(file)
      if (['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
        this.selectedFile = file;
        this.fileName = file.name
        console.log(file.name)
  
        // Konversi file ke base64
        const reader = new FileReader();
        reader.onload = (e: any) => {
          // Hapus prefix data URL jika ada
          const base64 = e.target.result.split(',')[1] || e.target.result;
          this.reporterDetailsFrom.ticketAttachment = base64;
        };
        reader.readAsDataURL(file);
        
      } else {
        this.fileName = ''
        this.functionMain.presentToast("Can only receive png, jpg, and jpg files!", 'danger')
      }
      
    }
  }

  uploadFile() {
    if (this.selectedFile) {
      this.functionMain.presentToast(`File ${this.selectedFile.name} ready to upload`, 'success');
    } else {
      this.functionMain.presentToast('Choose your file first', 'danger');
    }
  }

  onUploadImage(file: any): void {
    if (file){
      this.reporterDetailsFrom.ticketAttachment = file.map((data: any) => {return {ir_attachment_name: data.name, ir_attachment_datas: data.image, ir_attachment_mimetype: data.type }});
      console.log(this.reporterDetailsFrom)
    }
  }


}
