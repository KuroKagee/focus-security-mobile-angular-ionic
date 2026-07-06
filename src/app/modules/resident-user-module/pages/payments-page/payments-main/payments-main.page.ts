import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-payments-main',
  templateUrl: './payments-main.page.html',
  styleUrls: ['./payments-main.page.scss'],
})
export class PaymentsMainPage implements OnInit {

  userRole: string = '';
  longButtondata: any[] = [
    {
      id: 1,
      name: 'My Bills & Fees',
      src: 'assets/icon/resident-icon/payment-bills.png',
      routeLinkTo: '/bills-and-fines-page',
    },
    {
      id: 2,
      name: 'My Deposit',
      src: 'assets/icon/resident-icon/payment-manage.png',
      routeLinkTo: '/deposits-page',
    },
  ];

  constructor() { }

  ngOnInit() {
  }

  onChangeTypeFamily(event: any) {
    this.userRole = event;
    console.log(this.userRole)
    // if (this.userRole === "Member" || this.userRole === "Tenants") {
    //   this.longButtondata = [
    //     {
    //       id: 1,
    //       name: 'My Deposit',
    //       src: 'assets/icon/resident-icon/payment-manage.png',
    //       routeLinkTo: '/deposits-page',
    //     },
    //   ];
    // }
  }

}
