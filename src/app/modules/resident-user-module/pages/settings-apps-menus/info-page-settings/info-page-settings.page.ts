import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { catchError, throwError } from 'rxjs';
import { ApiService } from 'src/app/service/api.service';

export interface TutorialVideo {
  id: number;
  name: string;
  secure_url: string;
  video_source: string;
  thumbnail_url: string;
  video_title: string;
  sequence: number;
}

@Component({
  selector: 'app-info-page-settings',
  templateUrl: './info-page-settings.page.html',
  styleUrls: ['./info-page-settings.page.scss'],
})
export class InfoPageSettingsPage extends ApiService implements OnInit {

  pageName: string = '';
  currentversion: string = '';
  lastUpdatedDate: string = '';

  tutorialVideos: TutorialVideo[] = [];
  isLoadingVideos: boolean = false;
  videoError: string = '';
  familyId: number = 0;
  onChangeFamilyId(event: any) {
    this.familyId = event;
    if (this.familyId) {
        if (this.pageName === 'FAQ') {
        this.loadTutorialVideos();
      }
    }
  }

  constructor(
    http: HttpClient,
    private route: Router,
  ) {
    super(http);
    const navigation = this.route.getCurrentNavigation();
    const state = navigation?.extras.state as { pageName: string };
    if (state) {
      this.pageName = state.pageName;
    }
    this.getVersion();
  }

  ngOnInit() {
    
  }

  async getVersion() {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });
    const response: any = await this.http.post(
      this.baseUrl + '/get/app_detail',
      { jsonrpc: '2.0', params: {} },
      { headers }
    ).pipe(catchError(this.handleError)).toPromise();

    const [date] = response.result.when_the_app_get_update.split(' ');
    const [year, month, day] = date.split('-');
    this.lastUpdatedDate = `${day}-${month}-${year}`;

    const appInfo = await App.getInfo();
    this.currentversion = appInfo.version;
  }

  async loadTutorialVideos() {
    this.isLoadingVideos = true;
    this.videoError = '';
    try {
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      });
      const response: any = await this.http
        .post(
          this.baseUrl + '/api/tutorial-videos',
          { jsonrpc: '2.0', params: {
            family_id: this.familyId
          } },
          { headers }
        )
        .pipe(catchError(this.handleError))
        .toPromise();

      if (response?.result?.status === 'ok') {
        this.tutorialVideos = response.result.data as TutorialVideo[];
      } else {
        this.videoError = 'Failed to load tutorial videos.';
      }
    } catch (err) {
      this.videoError = 'Unable to connect. Please try again.';
    } finally {
      this.isLoadingVideos = false;
    }
  }

  openVideo(link: string) {
    if (!link) return;
    window.open(link, '_system');
  }

  private handleError(error: any) {
    console.error('An error occurred:', error);
    if (error.error instanceof ErrorEvent) {
      console.error('Client-side error:', error.error.message);
    } else {
      console.error(
        `Backend returned code ${error.status}, body was: ${error.error}`
      );
    }
    return throwError(() => new Error('Something went wrong; please try again later.'));
  }

  onClick(is_reload: boolean = false) {
    this.route.navigate(['/app-report-main'], {
      state: {
        fromWhere: 'setting-app-report',
      }
    });
  }
}

