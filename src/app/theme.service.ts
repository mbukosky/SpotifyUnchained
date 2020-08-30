import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {

  private darkMode = new BehaviorSubject(false);

  // TODO: load previous setting from storage
  constructor() { }

  isDarkMode(): Observable<boolean> {
    return this.darkMode.asObservable();
  }

  setLightMode(): void {
    console.log('Setting light mode');
    this.darkMode.next(false);
  }

  setDarkMode(): void {
    console.log('Setting dark mode');
    this.darkMode.next(true);
  }
}
