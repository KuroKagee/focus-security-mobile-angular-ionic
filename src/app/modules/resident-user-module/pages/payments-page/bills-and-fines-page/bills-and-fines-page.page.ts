import { Component, OnInit } from '@angular/core';
import { trigger, style, animate, transition } from '@angular/animations';
import { ModalController } from '@ionic/angular';

import { MainApiResidentService } from 'src/app/service/resident/main/main-api-resident.service';
import { FunctionMainService } from 'src/app/service/function/function-main.service';
import { ModalPaymentCustomComponent } from 'src/app/shared/resident-components/modal-payment-custom/modal-payment-custom.component';
import { ModalComponent } from 'src/app/shared/resident-components/choose-payment-methode/modal/modal.component';
import { ModalPaymentManualCustomComponent } from 'src/app/shared/resident-components/modal-payment-manual-custom/modal-payment-manual-custom.component';

interface payment {
  id: number,
  title: string,
  description: string,
  total: number,
  date: string,
  overdue_in: string,
  overdue: string,
  reason_for_rejection: string,
  manual_pay_submitted: boolean,
}

interface fines {
  id : number,
  fines_references : string,
  fines_name : string,
  start_date : string,
  due_date : string,
  total_bill : number,
  is_pay : boolean,
  overdue: boolean, // Menentukan status overdue
  offence_data : [
    {
      id : number,
      vehicle_number : string,
    }
  ],
  reason_for_rejection: string,
  manual_pay_submitted: boolean,
  requestor_id: number,
  requestor_name: string,
  member_type: string
}

interface FinesResponse {
  id: number,
  fines_references: string,
  fines_name: string,
  start_date: string,
  total_bill: string,
  offence_data: [],
  is_pay : string,
  pay_date: string,
}

interface FinesData {
  id: number,
  finesReferences: string,
  finesName: string,
  startDate: string,
  totalBill: string,
  offenceData: [],
  isPay : string,
  payDate: string,
}

interface BillsResponse {
  id: number,
  bill_references: string,
  bill_name: string,
  total_bill: number,
  pay_date: string,
  is_pay : boolean,
  start_date: string, 
}

interface BillsData {
  id: number,
  billReferences: string,
  billName: string,
  totalBill: number,
  payDate: string,
  isPay : boolean,
  startDate: string, 
}

@Component({
  selector: 'app-bills-and-fines-page',
  templateUrl: './bills-and-fines-page.page.html',
  styleUrls: ['./bills-and-fines-page.page.scss'],
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
export class BillsAndFinesPagePage implements OnInit {

  isLoading: boolean = true;
  navButtonsMain: any[] = [
    {
      text: 'My Bills',
      active: true,
      action: 'click',
    },
    {
      text: 'Fees',
      active: false,
      action: 'click',
    },
    {
      text: 'History',
      active: false,
      action: 'click',
    },
  ]
  showFines: boolean = false;
  showHistory: boolean = false;
  showBills: boolean = true;

  billsLoaded: payment[] = [];

  fines: fines[] = []

  groupedData: { [key: string]: any[] } = {};
  isFilterApplied: boolean = false;
  isDatePickerOpen: boolean = false;
  viewDate: Date = new Date(); // Tanggal yang akan ditampilkan
  viewDateForDatet: string = this.viewDate.toISOString().split('T')[0]; // Tanggal yang akan ditampilkan dalam
  filterByTypeValue: string = '';
  historyFines: FinesData[] = [];
  bills: BillsData[] = [];
  mergeData: any[] = [];
  familyType: string = '';

  constructor(
    private mainApiResidentService: MainApiResidentService,
    public functionMain: FunctionMainService,
    private modalController: ModalController
  ) { }

  ngOnInit() {
    // this.stripe = Stripe('pk_test_51QpnAMEYQAqGD36Tk2M4AdoDQ6ngZVc41jB8vp88UF3XaeytrViZM1R2ax04szYUfL8vH4SOn8qi7ZS32ZXrqz0h00qJH2GoBK');
  }

  familyId: number = 0;
  onChangeFamilyId(event: any) {
    this.familyId = event;
    console.log(this.familyId);
  }

  onChangeTypeFamily(event: any) {
    this.familyType = event;
    if (event === "Member" || event === 'Tenants') {
      this.navButtonsMain = [
        {
          text: 'Fees',
          active: false,
          action: 'click',
        },
        {
          text: 'History',
          active: false,
          action: 'click',
        },
      ]
      // Reset semua tombol menjadi tidak aktif
      this.navButtonsMain.forEach(button => {
        button.active = false;
      });

      // Aktifkan tombol yang sesuai
      const selectedButton = this.navButtonsMain.find(button => button.text === 'Fees');
      if (selectedButton) {
        selectedButton.active = true;
      }
      this.isLoading = true;
      this.showHistory = false;
      this.showBills = false;
      this.showFines = true;
      this.loadFinesData();
    } else {
      this.loadBills();
    }
  }

  handleRefresh(event: any) {
    this.isLoading = true;
    if (this.showBills) {
      setTimeout(() => {
        this.loadBills();
        event.target.complete();
      }, 1000)
    } else if (this.showFines) {
      setTimeout(() => {
        this.loadFinesData();
        event.target.complete();
      }, 1000)
    } else if (this.showHistory) {
      setTimeout(() => {
        this.loadHistoryPayment();
        event.target.complete();
      }, 1000)
    }
  }

  onClick(event: any) {
    // Reset semua tombol menjadi tidak aktif
    this.navButtonsMain.forEach(button => {
      button.active = false;
    });

    // Aktifkan tombol yang sesuai
    const selectedButton = this.navButtonsMain.find(button => button.text === event[1]);
    if (selectedButton) {
      selectedButton.active = true;
    }
    if (event[1] === 'My Bills') {
      this.isLoading = true;
      this.showFines = false;
      this.showHistory = false;
      this.showBills = true;
      this.loadBills();
    } else if (event[1] === 'Fees') {
      this.isLoading = true;
      this.showHistory = false;
      this.showBills = false;
      this.showFines = true;
      this.loadFinesData();
    } else if (event[1] === 'History') {
      this.isLoading = true;
      this.showBills = false;
      this.showFines = false;
      this.showHistory = true;
      this.loadHistoryPayment();
    }
  }

  loadBills() {
    this.billsLoaded = []
    this.billsLoaded.pop()
    this.mainApiResidentService.endpointMainProcess({}, 'get/active_bills').subscribe((result: any) => {
      this.isLoading = false;
      // console.log(result);
      const paymentLoaded = result.result.response_result;

      this.billsLoaded = paymentLoaded.map((item: any) => {
        return {
          id: item.id,
          title: item.bill_references,
          description: item.bill_name,
          total: Number(item.total_bill),
          date: item.start_date,
          overdue_in: item.due_date,
          overdue: item.overdue,
          reason_for_rejection: item.reason_for_rejection, // Menentukan status overdue
          manual_pay_submitted: item.manual_pay_submitted,
        } as payment; // Menyatakan bahwa objek ini sesuai dengan tipe payment
      });

      console.log(this.billsLoaded);

    })
  }

  loadFinesData() {
    this.fines = []
    this.fines.pop()
    this.mainApiResidentService.endpointMainProcess({}, 'get/active_fines').subscribe((response: any) => {
      this.isLoading = false
      // console.log(response.result)
      const finesLoaded = response.result.response_result;

      this.fines = finesLoaded.map((fine: any) => {
        return {
          id : fine.id,
          fines_references : fine.fines_references,
          fines_name : fine.fines_name,
          start_date : fine.start_date,
          due_date : fine.due_date,
          total_bill : fine.total_bill,
          is_pay : fine.is_pay,
          overdue: fine.overdue, // Menentukan status overdue
          offence_data : fine.offence_data.map((offence_data: any) => {
            return {
              id : offence_data.id,
              vehicle_number : offence_data.vehicle_number,
            }
          }),
          reason_for_rejection: fine.reason_for_rejection,
          manual_pay_submitted: fine.manual_pay_submitted,
          requestor_id: fine.requestor_id,
          member_type: fine.member_type,
          requestor_name: fine.requestor_name
        }
      })
      console.log(this.fines);
    })
  }

  // Method tambahan untuk perbaikan
  onDateChange(event: any) {
    this.viewDate = new Date(event.detail.value);
    this.isFilterApplied = true;
    this.isDatePickerOpen = false; // Tutup modal setelah memilih tanggal
    this.loadHistoryPayment(); // Reload data dengan filter baru
  }

  filterByType(event: any) {
    const value = event.target.value;
    this.filterByTypeValue = value;
    this.loadHistoryPayment();
  }

  clearFilter() {
    this.filterByTypeValue = '';
    this.viewDate = new Date();
    this.isFilterApplied = false;
    this.loadHistoryPayment();
  }

  openDatePicker() {
    this.isDatePickerOpen = true; // Membuka modal pemilih tanggal
  }

  loadHistoryPayment() {
    this.mergeData = [];
    this.mergeData.pop();
    
    this.mainApiResidentService.endpointMainProcess({}, 'get/payment_history').subscribe((response: any) => {
      const fines = response.result.response_result.fines;
      let bills = [];
      if (!(this.familyType === 'Tenants' || this.familyType === 'Member')) {
        bills = response.result.response_result.bills;
      }
      
      // Transform fines data
      this.historyFines = fines.map((fine: FinesResponse) => {
        return {
          id: fine.id,
          fines_references: fine.fines_references,
          fines_name: fine.fines_name,
          start_date: fine.start_date,
          total_bill: fine.total_bill,
          is_pay: fine.is_pay,
          offence_data: fine.offence_data.map((offence_data: any) => {
            return {
              id: offence_data.id,
              vehicle_number: offence_data.vehicle_number,
            }
          }),
          pay_date: fine.pay_date,
        }
      });

      // Transform bills data
      this.bills = bills.map((bill: BillsResponse) => {
        return {
          id: bill.id,
          bill_references: bill.bill_references,
          bill_name: bill.bill_name,
          total_bill: bill.total_bill,
          is_pay: bill.is_pay,
          pay_date: bill.pay_date,
          start_date: bill.start_date,
        }
      });

      // Merge data berdasarkan filter tipe
      if (this.filterByTypeValue === 'bills') {
        this.mergeData = [...this.bills];
      } else if (this.filterByTypeValue === 'fines') {
        this.mergeData = [...this.historyFines];
      } else {
        this.mergeData = [...this.historyFines, ...this.bills];
      }

      // Urutkan berdasarkan tanggal
      this.mergeData.sort((a, b) => {
        const dateA = new Date(a.start_date);
        const dateB = new Date(b.start_date);
        return dateA.getTime() - dateB.getTime();
      });

      // Filter berdasarkan tanggal jika filter diterapkan
      if (this.isFilterApplied) {
        const selectedMonth = this.viewDate.getMonth();
        const selectedYear = this.viewDate.getFullYear();

        this.mergeData = this.mergeData.filter(item => {
          const date = new Date(item.pay_date || item.start_date);
          return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
        });
      }

      // Grouping the data by month and year
      this.groupedData = this.groupByMonthYear(this.mergeData);
      this.isLoading = false;
    });
  }

  getMonthYears(): string[] {
    return Object.keys(this.groupedData);
  }

  groupByMonthYear(data: any[]) {
    return data.reduce((acc, item) => {
      const date = new Date(item.pay_date || item.start_date);
      const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!acc[monthYear]) {
        acc[monthYear] = [];
      }
      acc[monthYear].push(item);
      return acc;
    }, {});
  }

  async payNow(paymentId: number, model: string) {
    const modal = await this.modalController.create({
      component: ModalComponent,
      cssClass: 'choose-pay-modal',
      componentProps: {
        paymentId: paymentId
      }
    })

    modal.onDidDismiss().then((result) => {
      if (result.data) {
        this.processPayment(result.data, model, paymentId)
      } else {
        return
      }
    });

    return await modal.present();
  }

  processPayment(result: any, model: string, paymentId: number) {
    if (result[1] === 'electronic') {
      this.electricPay(result[0], model, paymentId);
    } else {
      this.manualPay(result[2])
    }
  }

  electricPay(stripe: any, model: string, paymentId: number) {
    // console.log(this.showBills ? this.billsLoaded.find(bill => bill.id === paymentId)?.total : this.fines.find(fine => fine.id === paymentId)?.total_bill);
    this.mainApiResidentService.endpointCustomProcess({
      id: paymentId,
      model: model,
      amount_total_field: this.showBills ? 'bill_total' : 'total_bill',
    }, '/create-payment-intent').subscribe((response: any) => {
      const clientSecret = response.result.Intent.client_secret; // Adjust based on your API response structure
      if (clientSecret) {
        this.stripeId = response.result.Intent.id; // Simpan ID pembayaran
        this.presentModal(clientSecret, stripe)
      }
    })
  }

  stripeId: string = ''; // Replace with your actual publishable key
  async presentModal(clientSecret: string, stripe: any) {
    const modal = await this.modalController.create({
      component: ModalPaymentCustomComponent,
      cssClass: 'payment-modal',
      id: 'payment-modal-stripe-name',
      componentProps: {
        stripe: stripe,
        clientSecret: clientSecret,
        stripeId: this.stripeId,
        from: 'bills-and-fines-page',
      }
    });

    modal.onDidDismiss().then((result) => {
      console.log('Modal dismissed with data:', result);
      if (result.data) {
        const message = this.showBills ? 'Bill' : 'Fine';
        this.functionMain.presentToast(`Success Pay the ${message}.`, 'success');
        if (this.showBills) {
          this.loadBills();
        } else if (this.showFines) {
          this.loadFinesData();
        }
      } else {
        return;
      }
    });

    return await modal.present();
  }

  async manualPay(paymentId: number) {
    const modal = await this.modalController.create({
      component: ModalPaymentManualCustomComponent,
      cssClass: 'upload-receipt-manual-pay',
      componentProps: {}
    });

    modal.onDidDismiss().then((result) => {
      if (result.data) {
        if (this.showBills) {
          this.mainApiResidentService.endpointMainProcess({
            bills_id: paymentId,
            payment_proof: result.data
          }, 'post/manual_pay_bills').subscribe((response: any) => {
            this.loadBills();
          })
        } else if (this.showFines) {
          this.mainApiResidentService.endpointMainProcess({
            fines_id: paymentId,
            payment_proof: result.data
          }, 'post/manual_pay_fines').subscribe((response: any) => {
            this.loadFinesData();
          })
        }
      } else {
        this.functionMain.presentToast('Please upload payment receipt', 'danger');
        return
      }
    });

    return await modal.present();
  }
}
