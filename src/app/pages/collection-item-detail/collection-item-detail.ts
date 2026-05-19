import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnDestroy,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CollectionItem, Rarities } from '../../models/collection-item';
import { CollectionItemCard } from '../../components/collection-item-card/collection-item-card';
import { CollectionService } from '../../services/collection-service';
import { Collection } from '../../models/collection';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-collection-item-detail',
  imports: [
    ReactiveFormsModule,
    CollectionItemCard,
    RouterLink,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './collection-item-detail.html',
  styleUrl: './collection-item-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionItemDetail implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly collectionService = inject(CollectionService);
  private readonly snackBar = inject(MatSnackBar);

  rarities = Object.values(Rarities);
  isSaving = signal(false);
  isDeleting = signal(false);

  collectionId = input<number | null, string | null>(null, {
    alias: 'collectionId',
    transform: (v: string | null) => (v ? parseInt(v) : null),
  });

  itemId = input<number | null, string | null>(null, {
    alias: 'itemId',
    transform: (v: string | null) => (v ? parseInt(v) : null),
  });

  selectedCollection = signal<Collection | null>(null);

  nextItemId = computed(() => {
    const items = this.selectedCollection()?.items ?? [];
    const idx = items.findIndex(i => i.id === this.itemId());
    return idx !== -1 && idx < items.length - 1 ? items[idx + 1].id : null;
  });

  prevItemId = computed(() => {
    const items = this.selectedCollection()?.items ?? [];
    const idx = items.findIndex(i => i.id === this.itemId());
    return idx > 0 ? items[idx - 1].id : null;
  });
  collectionItem = signal<CollectionItem>(new CollectionItem());

  itemFormGroup = this.fb.group({
    name: ['', [Validators.required]],
    description: ['', [Validators.required]],
    image: [''],
    rarity: ['', [Validators.required]],
    price: [0, [Validators.required, Validators.min(0)]],
  });

  valueChangeSubscription: Subscription | null = null;

  constructor() {
    effect(() => {
      const cid = this.collectionId();
      const iid = this.itemId();
      if (!cid) return;

      this.collectionService.get(cid).subscribe({
        next: (collection) => {
          if (!collection) {
            this.router.navigate(['/not-found']);
            return;
          }
          this.selectedCollection.set(collection);

          let itemToDisplay = new CollectionItem();
          if (iid) {
            const found = collection.items.find((item) => item.id === iid);
            if (found) {
              itemToDisplay = found;
            } else {
              this.router.navigate(['/not-found']);
              return;
            }
          }
          this.itemFormGroup.patchValue(itemToDisplay);
        },
        error: () => this.router.navigate(['/not-found']),
      });
    });

    this.valueChangeSubscription = this.itemFormGroup.valueChanges.subscribe((_) => {
      this.collectionItem.set(Object.assign(new CollectionItem(), this.itemFormGroup.value));
    });
  }

  submit(event: Event) {
    event.preventDefault();
    const collection = this.selectedCollection();
    if (this.itemFormGroup.invalid || !collection) return;

    this.isSaving.set(true);
    const formValue = this.itemFormGroup.value as Partial<CollectionItem>;
    const itemToSave = Object.assign(new CollectionItem(), formValue);

    const cid = collection.id;

    const req = this.itemId()
      ? this.collectionService.updateItem(collection, {
          ...itemToSave,
          id: this.itemId()!,
        })
      : this.collectionService.addItem(collection, itemToSave);

    req.subscribe({
      next: () => {
        this.snackBar.open(this.itemId() ? 'Objet mis à jour' : 'Objet créé', 'Fermer', {
          duration: 3000,
        });
        this.router.navigate(['/collection', cid]);
      },
      error: () => {
        this.snackBar.open('Une erreur est survenue', 'Fermer', { duration: 5000 });
        this.isSaving.set(false);
      },
    });
  }

  isFieldValid(fieldName: string) {
    const formControl = this.itemFormGroup.get(fieldName);
    return formControl?.invalid && (formControl?.dirty || formControl?.touched);
  }

  cancel() {
    const cid = this.selectedCollection()?.id;
    this.router.navigate(cid ? ['/collection', cid] : ['/collection']);
  }

  deleteItem() {
    const collection = this.selectedCollection();
    if (!this.itemId() || !collection) return;
    const confirmed = confirm('Supprimer cet objet ?');
    if (!confirmed) return;

    this.isDeleting.set(true);
    const cid = collection.id;
    this.collectionService.deleteItem(cid, this.itemId()!).subscribe({
      next: () => {
        this.snackBar.open('Objet supprimé', 'Fermer', { duration: 3000 });
        this.router.navigate(['/collection', cid]);
      },
      error: () => {
        this.snackBar.open('Erreur suppression', 'Fermer', { duration: 5000 });
        this.isDeleting.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.valueChangeSubscription?.unsubscribe();
  }
}
