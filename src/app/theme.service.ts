import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {

  private darkMode = new BehaviorSubject(false);

  constructor() {
    const setting = localStorage.getItem('darkMode');
    if (setting === 'true') {
      this.darkMode.next(true);
    }
  }

  isDarkMode(): Observable<boolean> {
    return this.darkMode.asObservable();
  }

  setLightMode(): void {
    console.log('Setting light mode');
    this.darkMode.next(false);
    localStorage.setItem('darkMode', 'false');
  }

  setDarkMode(): void {
    console.log('Setting dark mode');
    this.darkMode.next(true);
    localStorage.setItem('darkMode', 'true');
  }
}
