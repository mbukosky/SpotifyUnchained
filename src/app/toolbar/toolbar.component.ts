import { Component, OnInit } from '@angular/core';
import { faGithub, faTwitter, faPaypal } from '@fortawesome/free-brands-svg-icons';
import { MenuItem } from './menu-item';
import { SpotifyService } from '../spotify.service';
import { ThemeService } from '../theme.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent implements OnInit {

  menuItems: MenuItem[] = [
    {
      label: 'GitHub',
      icon: faGithub,
      link: 'https://github.com/mbukosky/SpotifyUnchained',
      showOnMobile: false,
      showOnTablet: false,
      showOnDesktop: true,
    },
    {
      label: 'Twitter',
      icon: faTwitter,
      link: 'https://twitter.com/SpotifyUnchnd',
      showOnMobile: false,
      showOnTablet: false,
      showOnDesktop: true,
    },
    {
      label: 'PayPal',
      icon: faPaypal,
      link: 'https://paypal.me/mbukosky/1',
      showOnMobile: false,
      showOnTablet: false,
      showOnDesktop: true,
    }
  ];

  constructor(private spotify: SpotifyService, private themeService: ThemeService) { }

  ngOnInit(): void {
    this.spotify.loadOrSaveToken();
  }

  isLoggedIn(): boolean {
    return this.spotify.isLoggedIn();
  }

  login(): void {
    this.spotify.login();
  }

  getUser(): Observable<SpotifyApi.CurrentUsersProfileResponse> {
    return this.spotify.getCurrentUser();
  }

  logout(): void {
    this.spotify.logout();
  }

  isDarkMode(): Observable<boolean> {
    return this.themeService.isDarkMode();
  }

  setDarkMode(): void {
    this.themeService.setDarkMode();
  }

  setLightMode(): void {
    this.themeService.setLightMode();
  }
}
