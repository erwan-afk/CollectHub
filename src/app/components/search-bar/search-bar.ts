import { ChangeDetectionStrategy, Component, model, OutputEmitterRef, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
@Component({
  selector: 'search-bar',
  imports: [FormsModule, MatInputModule, MatIconModule],
  templateUrl: './search-bar.html',
  styleUrl: './search-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBar {
  searchButtonClicked: OutputEmitterRef<void> = output<void>({
    alias: 'submit',
  });
  searchClick() {
    this.searchButtonClicked.emit();
  }
  search = model('Initial');
}
