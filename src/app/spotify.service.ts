import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, from, BehaviorSubject } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SpotifyService {

  private apiBase = 'https://api.spotify.com/v1';
  private tokenName = 'spotify-token';
  private expirationName = 'spotify-token-expiration';
  private clientId = environment.spotifyClientId;
  private redirectUri = window.location.origin + '/callback.html';
  private scope = 'playlist-read-private playlist-modify-private';

  private authToken: string;
  private initializedUser = false;

  private userSubject: BehaviorSubject<SpotifyApi.CurrentUsersProfileResponse>
    = new BehaviorSubject(null);
  private playlistsSubject:
    BehaviorSubject<SpotifyApi.ListOfCurrentUsersPlaylistsResponse>
    = new BehaviorSubject(null);

  constructor(private httpClient: HttpClient) { }

  isLoggedIn(): boolean {
    const token = localStorage.getItem(this.tokenName);
    if (token) {
      const expiration = localStorage
        .getItem(this.expirationName);
      if (expiration && Number(expiration) > new Date().getTime() + 120) {
        this.authToken = token;
        return true;
      }
    }
    return false;
  }

  // tslint:disable-next-line: max-line-length
  // This is based on https://github.com/eduardolima93/angular2-spotify/blob/41c7fd7df9fc34666646639fb3085245ae2c45a8/angular2-spotify.ts
  login(): Observable<string> {
    const promise = new Promise<string>((resolve, reject) => {
      const w = 400;
      const h = 500;
      const left = (screen.width / 2) - (w / 2);
      const top = (screen.height / 2) - (h / 2);

      const params = {
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        scope: this.scope || '',
        response_type: 'token'
      };
      let authCompleted = false;
      const authWindow = this.openDialog(
        'https://accounts.spotify.com/authorize?' + this.toQueryString(params),
        'Spotify',
        'menubar=no,location=no,resizable=yes,scrollbars=yes,status=no,width=' + w + ',height=' + h + ',top=' + top + ',left=' + left,
        () => {
          if (!authCompleted) {
            return reject('Login rejected error');
          }
        }
      );

      const storageChanged = (e) => {
        if (e.key === this.tokenName) {
          if (authWindow) {
            authWindow.close();
          }
          authCompleted = true;

          this.authToken = e.newValue;
          window.removeEventListener('storage', storageChanged, false);
          this.initializedUser = true;
          this.initializeUser();

          return resolve(e.newValue);
        }
      };
      window.addEventListener('storage', storageChanged, false);
    });

    return from(promise);
  }

  logout(): void {
    // TODO: logout from spotify.com as well?
    this.userSubject.next(null);
    this.initializedUser = false;
    localStorage.removeItem(this.tokenName);
    localStorage.removeItem(this.expirationName);
  }

  initializeUser(): void {
    this.downloadUserInfo().subscribe(profile => {
      this.userSubject.next(profile);
    });
    this.downloadUserSavedPlaylists().subscribe(playlists => {
      this.playlistsSubject.next(playlists);
    });
  }

  getCurrentUser(): Observable<SpotifyApi.CurrentUsersProfileResponse> {
    if (this.isLoggedIn() && !this.initializedUser) {
      this.initializedUser = true;
      this.initializeUser();
    }
    return this.userSubject.asObservable();
  }

  getUserSavedPlaylists(): Observable<SpotifyApi.ListOfCurrentUsersPlaylistsResponse> {
    return this.playlistsSubject.asObservable();
  }

  private downloadUserInfo(): Observable<SpotifyApi.CurrentUsersProfileResponse> {
    return this.httpClient.get<SpotifyApi.CurrentUsersProfileResponse>
      (this.apiBase + '/me', {
        headers: this.getAuthHeader(),
      });
  }

  private downloadUserSavedPlaylists():
    Observable<SpotifyApi.ListOfCurrentUsersPlaylistsResponse> {
    // TODO: do more requests if a user has over 50 playlists
    return this.httpClient.get<SpotifyApi.ListOfCurrentUsersPlaylistsResponse>(this.apiBase + '/me/playlists', {
      headers: this.getAuthHeader(),
      params: new HttpParams().set('limit', '50'),
    });
  }

  private openDialog(uri: string, name: string, options: string, cb): Window {
    const win = window.open(uri, name, options);
    const interval = window.setInterval(() => {
      try {
        if (!win || win.closed) {
          window.clearInterval(interval);
          cb(win);
        }
      } catch (e) { }
    }, 1000000);
    return win;
  }

  private toQueryString(obj): string {
    const parts = [];
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        parts.push(encodeURIComponent(key) + '=' +
          encodeURIComponent(obj[key]));
      }
    }
    return parts.join('&');
  }

  private getAuthHeader(): HttpHeaders {
    return new HttpHeaders().set('Authorization', 'Bearer ' + this.authToken);
  }
}
