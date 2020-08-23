import { Component, OnInit } from '@angular/core';
import { faGithub, faTwitter, faPaypal } from '@fortawesome/free-brands-svg-icons';
import { MenuItem } from './menu-item';

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.css']
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

  constructor() { }

  ngOnInit(): void {
  }

}
