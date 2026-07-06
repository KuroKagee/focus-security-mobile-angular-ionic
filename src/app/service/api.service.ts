import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // readonly baseUrl = 'https://ifs360-sg.com';
  // readonly baseUrl = 'https://testing-ifs360.sgdemo.org';
  // readonly baseUrl = 'http://192.168.1.212:8069';
  readonly baseUrl = 'http://192.168.1.217:8017';
  // readonly baseUrl = 'http://10.56.232.230:8017';
  // readonly baseUrl = 'https://5b8a-2001-448a-8020-17d8-d5c1-973d-a840-c701.ngrok-free.app';

  constructor(protected http: HttpClient) { }
}
