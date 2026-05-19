import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router, RouterOutlet, RouterLink, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CollectionService } from './services/collection-service';
import { Collection } from './models/collection';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    FormsModule,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
})
export class App implements OnInit {
  private readonly collectionService = inject(CollectionService);
  private readonly router = inject(Router);

  isDark = signal(true);
  collections = signal<Collection[]>([]);
  editingId = signal<number | null>(null);
  editingTitle = signal('');
  newCollectionTitle = signal('');
  private currentUrl = signal(this.router.url);

  activeCollectionId = computed(() => {
    const url = this.currentUrl();
    const match = url.match(/\/collection\/(\d+)/);
    if (match) return parseInt(match[1]);
    const all = this.collections();
    return all.length > 0 ? all[0].id : null;
  });

  ngOnInit() {
    const saved = localStorage.getItem('theme');
    const dark = saved ? saved === 'dark' : true;
    this.isDark.set(dark);
    this.applyTheme(dark);
    this.loadCollections();
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      this.currentUrl.set(this.router.url);
    });
  }

  loadCollections() {
    this.collectionService.getAll().subscribe({
      next: (data) => this.collections.set(data),
      error: (err) => console.error('Erreur chargement collections', err),
    });
  }

  toggleTheme() {
    const dark = !this.isDark();
    this.isDark.set(dark);
    this.applyTheme(dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }

  private applyTheme(dark: boolean) {
    document.documentElement.classList.toggle('dark', dark);
  }

  createCollection() {
    const title = this.newCollectionTitle().trim();
    if (!title) return;
    const c = new Collection();
    c.title = title;
    this.collectionService.add(c).subscribe({
      next: (created) => {
        this.newCollectionTitle.set('');
        this.loadCollections();
        this.router.navigate(['/collection', created.id]);
      },
      error: (err) => console.error('Erreur création collection', err),
    });
  }

  startRename(collection: Collection) {
    this.editingId.set(collection.id);
    this.editingTitle.set(collection.title);
  }

  saveRename(collection: Collection) {
    const title = this.editingTitle().trim();
    if (title && title !== collection.title) {
      collection.title = title;
      this.collectionService.update(collection).subscribe({
        next: () => this.loadCollections(),
        error: (err) => console.error('Erreur renommage', err),
      });
    }
    this.editingId.set(null);
  }

  cancelRename() {
    this.editingId.set(null);
  }

  deleteCollection(event: Event, collection: Collection) {
    event.stopPropagation();
    const confirmed = confirm(`Supprimer la collection "${collection.title}" et tous ses objets ?`);
    if (!confirmed) return;
    this.collectionService.delete(collection.id).subscribe({
      next: () => {
        this.loadCollections();
        const remaining = this.collections();
        if (remaining.length > 0) {
          this.router.navigate(['/collection', remaining[0].id]);
        } else {
          this.router.navigate(['/collection']);
        }
      },
      error: (err) => console.error('Erreur suppression', err),
    });
  }

  navigateToCollection(id: number) {
    this.router.navigate(['/collection', id]);
  }

  addItemToActiveCollection() {
    const id = this.activeCollectionId();
    if (id) {
      this.router.navigate(['/collection', id, 'item']);
    }
  }

  isActive(id: number): boolean {
    return this.activeCollectionId() === id;
  }
}
