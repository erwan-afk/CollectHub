import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SearchBar } from '../../components/search-bar/search-bar';
import { CollectionItemCard } from '../../components/collection-item-card/collection-item-card';
import { CollectionService } from '../../services/collection-service';
import { Collection } from '../../models/collection';
import { CollectionItem, Rarity, Rarities } from '../../models/collection-item';

@Component({
  selector: 'app-collection-detail',
  imports: [
    CollectionItemCard,
    SearchBar,
    MatSnackBarModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './collection-detail.html',
  styleUrl: './collection-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionDetail {
  private readonly collectionService = inject(CollectionService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  collectionId = input<number | null, string | null>(null, {
    alias: 'collectionId',
    transform: (v: string | null) => (v ? parseInt(v) : null),
  });

  search = model('');
  isLoading = signal(false);
  sortBy = signal<'name' | 'rarity' | 'price'>('name');
  sortDirection = signal<'asc' | 'desc'>('asc');
  filterRarity = signal<Rarity | null>(null);
  rarities = Object.values(Rarities);

  selectedCollection = signal<Collection | null>(null);

  displayedItems = computed(() => {
    let allItems = this.selectedCollection()?.items || [];
    const searchTerm = (this.search() || '').toLowerCase();
    if (searchTerm) {
      allItems = allItems.filter((item) => item.name.toLowerCase().includes(searchTerm));
    }
    const rarity = this.filterRarity();
    if (rarity) {
      allItems = allItems.filter((item) => item.rarity === rarity);
    }
    const sortKey = this.sortBy();
    const direction = this.sortDirection();
    allItems = [...allItems].sort((a, b) => {
      let comparison = 0;
      if (sortKey === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortKey === 'rarity') {
        const rarityOrder: Record<Rarity, number> = {
          Legendary: 3,
          Rare: 2,
          Uncommon: 1,
          Common: 0,
        };
        comparison = (rarityOrder[a.rarity] ?? 0) - (rarityOrder[b.rarity] ?? 0);
      } else if (sortKey === 'price') {
        comparison = a.price - b.price;
      }
      return direction === 'asc' ? comparison : -comparison;
    });
    return allItems;
  });

  constructor() {
    effect(() => {
      this.loadCollection();
    });
  }

  private loadCollection() {
    this.isLoading.set(true);
    const cid = this.collectionId();

    if (cid) {
      this.collectionService.get(cid).subscribe({
        next: (collection) => {
          this.selectedCollection.set(collection);
          this.isLoading.set(false);
        },
        error: () => {
          this.snackBar.open('Erreur lors du chargement', 'Fermer', { duration: 5000 });
          this.isLoading.set(false);
        },
      });
    } else {
      this.collectionService.getAll().subscribe({
        next: (collections) => {
          this.selectedCollection.set(collections.length > 0 ? collections[0] : null);
          this.isLoading.set(false);
        },
        error: () => {
          this.snackBar.open('Erreur lors du chargement', 'Fermer', { duration: 5000 });
          this.isLoading.set(false);
        },
      });
    }
  }

  toggleSort(field: 'name' | 'rarity' | 'price') {
    if (this.sortBy() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(field);
      this.sortDirection.set('asc');
    }
  }

  toggleRarityFilter(rarity: Rarity) {
    if (this.filterRarity() === rarity) {
      this.filterRarity.set(null);
    } else {
      this.filterRarity.set(rarity);
    }
  }

  clearFilters() {
    this.search.set('');
    this.filterRarity.set(null);
    this.sortBy.set('name');
    this.sortDirection.set('asc');
  }

  addItem() {
    const cid = this.selectedCollection()?.id;
    if (cid) {
      this.router.navigate(['/collection', cid, 'item']);
    }
  }

  openItem(item: CollectionItem) {
    const cid = this.selectedCollection()?.id;
    if (cid) {
      this.router.navigate(['/collection', cid, 'item', item.id]);
    }
  }

  deleteCollection() {
    const collection = this.selectedCollection();
    if (!collection) return;
    const confirmed = confirm(`Supprimer "${collection.title}" ?`);
    if (!confirmed) return;
    this.collectionService.delete(collection.id).subscribe({
      next: () => {
        this.snackBar.open('Collection supprimée', 'Fermer', { duration: 3000 });
        this.router.navigate(['/collection']);
      },
      error: () => this.snackBar.open('Erreur suppression', 'Fermer', { duration: 5000 }),
    });
  }

  getSortIcon(field: 'name' | 'rarity' | 'price'): string {
    if (this.sortBy() !== field) return '';
    return this.sortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }
}
