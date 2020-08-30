import { Component } from '@angular/core';
import { ThemeService } from './theme.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'SpotifyUnchained';

  constructor(private themeService: ThemeService) { }

  isDarkMode(): Observable<boolean> {
    return this.themeService.isDarkMode();
  }
}
