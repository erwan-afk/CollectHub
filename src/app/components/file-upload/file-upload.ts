import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

@Component({
  selector: 'file-upload',
  templateUrl: './file-upload.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileUpload {
  hasError = input(false);
  fileChange = output<string>();

  isDragging = signal(false);
  fileName = signal<string | null>(null);
  preview = signal<string | null>(null);
  progress = signal(0);
  isLoading = signal(false);

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave() {
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.readFile(file);
  }

  onChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.readFile(file);
  }

  private readFile(file: File) {
    if (!file.type.startsWith('image/')) return;

    this.fileName.set(file.name);
    this.progress.set(0);
    this.isLoading.set(true);

    const reader = new FileReader();

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        this.progress.set(Math.round((e.loaded / e.total) * 100));
      }
    };

    reader.onload = () => {
      const result = reader.result as string;
      this.progress.set(100);
      this.isLoading.set(false);
      this.preview.set(result);
      this.fileChange.emit(result);
    };

    reader.readAsDataURL(file);
  }

  clear() {
    this.fileName.set(null);
    this.preview.set(null);
    this.progress.set(0);
    this.fileChange.emit('');
  }
}
