import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { AiChatService } from '../../services/ai-chat.service';

interface ToolStep {
  name: string;
  done: boolean;
}

interface UiMessage {
  role: 'user' | 'assistant';
  content: string;
  isStreaming: boolean;
  steps: ToolStep[];
  error?: string;
  durationMs?: number;
}

interface Conversation {
  id: string;
  title: string;
  messages: UiMessage[];
  createdAt: number;
}

const TOOL_LABELS: Record<string, string> = {
  search_invoices: 'Recherche factures',
  get_invoice_stats: 'Statistiques',
  get_invoice_detail: 'Détail facture',
  compare_periods: 'Comparaison périodes',
  semantic_search_invoices: 'Recherche sémantique',
  aggregate_invoices: 'Agrégation',
};

const STORAGE_KEY = 'ai_conversations';

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DecimalPipe, MatIconModule],
  template: `
    <div class="flex" style="height: calc(100vh - 3rem)">

      <!-- Panneau conversations -->
      <div class="w-56 flex-shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <div class="px-3 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <button
            class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            (click)="newConversation()"
          >
            <mat-icon class="!text-sm !w-4 !h-4">add</mat-icon>
            Nouvelle conversation
          </button>
        </div>

        <div class="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          @for (conv of conversations(); track conv.id) {
            <div
              class="group flex items-center gap-1.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors"
              [class.bg-white]="activeId() === conv.id"
              [class.dark:bg-zinc-800]="activeId() === conv.id"
              [class.shadow-sm]="activeId() === conv.id"
              [class.hover:bg-white]="activeId() !== conv.id"
              [class.dark:hover:bg-zinc-800]="activeId() !== conv.id"
              (click)="selectConversation(conv.id)"
            >
              <mat-icon class="!text-sm !w-4 !h-4 flex-shrink-0 text-zinc-400 dark:text-zinc-500">chat_bubble_outline</mat-icon>
              <span class="flex-1 text-xs truncate"
                [class.text-zinc-900]="activeId() === conv.id"
                [class.dark:text-zinc-100]="activeId() === conv.id"
                [class.text-zinc-600]="activeId() !== conv.id"
                [class.dark:text-zinc-400]="activeId() !== conv.id"
              >{{ conv.title }}</span>
              <button
                class="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded text-zinc-400 hover:text-red-500 transition-all flex-shrink-0"
                (click)="$event.stopPropagation(); deleteConversation(conv.id)"
              >
                <mat-icon class="!text-xs !w-3 !h-3">close</mat-icon>
              </button>
            </div>
          }

          @if (conversations().length === 0) {
            <p class="text-[11px] text-zinc-400 dark:text-zinc-600 text-center py-6 px-3">
              Aucune conversation.<br>Commencez en posant une question.
            </p>
          }
        </div>
      </div>

      <!-- Zone chat -->
      <div class="flex-1 flex flex-col min-w-0">

        <!-- Messages -->
        <div class="flex-1 overflow-y-auto" #scrollContainer>
          <div class="max-w-3xl mx-auto px-4 py-6 space-y-4">

            @if (activeMessages().length === 0) {
              <div class="flex flex-col items-center justify-center h-[60vh] gap-3 text-center">
                <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <mat-icon class="!text-xl text-white">smart_toy</mat-icon>
                </div>
                <p class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Agent IA Factures</p>
                <p class="text-xs text-zinc-400 dark:text-zinc-500 max-w-xs">
                  Posez une question sur vos factures, fournisseurs ou statistiques.
                </p>
                <div class="flex flex-col gap-2 mt-2 w-full max-w-sm">
                  @for (ex of examples; track ex) {
                    <button
                      class="text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left bg-white dark:bg-zinc-900"
                      (click)="sendExample(ex)"
                    >{{ ex }}</button>
                  }
                </div>
              </div>
            }

            @for (msg of activeMessages(); track $index) {
              @if (msg.role === 'user') {
                <div class="flex justify-end">
                  <div class="max-w-[75%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-indigo-600 text-white text-sm leading-relaxed">
                    {{ msg.content }}
                  </div>
                </div>
              } @else {
                <div class="flex gap-2.5 max-w-[85%]">
                  <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                    <mat-icon class="!text-sm !w-3.5 !h-3.5 text-white">smart_toy</mat-icon>
                  </div>
                  <div class="flex-1 space-y-2">

                    @if (msg.steps.length > 0) {
                      <div class="flex flex-wrap gap-1.5">
                        @for (step of msg.steps; track step.name) {
                          <span
                            class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors"
                            [class.border-indigo-200]="!step.done"
                            [class.dark:border-indigo-800]="!step.done"
                            [class.text-indigo-600]="!step.done"
                            [class.dark:text-indigo-400]="!step.done"
                            [class.bg-indigo-50]="!step.done"
                            [class.dark:bg-indigo-950]="!step.done"
                            [class.border-zinc-200]="step.done"
                            [class.dark:border-zinc-700]="step.done"
                            [class.text-zinc-500]="step.done"
                            [class.dark:text-zinc-400]="step.done"
                            [class.bg-white]="step.done"
                            [class.dark:bg-zinc-900]="step.done"
                          >
                            <mat-icon class="!text-[10px] !w-3 !h-3">{{ step.done ? 'check_circle' : 'pending' }}</mat-icon>
                            {{ toolLabel(step.name) }}
                          </span>
                        }
                      </div>
                    }

                    @if (msg.content) {
                      <div
                        class="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed"
                        [innerHTML]="renderMarkdown(msg.content)"
                      ></div>
                    } @else if (msg.isStreaming && msg.steps.length === 0) {
                      <div class="flex gap-1 items-center h-5">
                        <span class="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce [animation-delay:-0.3s]"></span>
                        <span class="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce [animation-delay:-0.15s]"></span>
                        <span class="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce"></span>
                      </div>
                    }

                    @if (msg.error) {
                      <p class="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                        <mat-icon class="!text-xs !w-3 !h-3">error_outline</mat-icon>
                        {{ msg.error }}
                      </p>
                    }

                    @if (msg.durationMs && !msg.isStreaming && !msg.error) {
                      <p class="text-[10px] text-zinc-400 dark:text-zinc-600 tabular-nums">
                        {{ msg.durationMs / 1000 | number: '1.1-1' }}s
                      </p>
                    }
                  </div>
                </div>
              }
            }

            <div #messagesEnd></div>
          </div>
        </div>

        <!-- Barre de saisie -->
        <div class="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 bg-white dark:bg-zinc-950 flex-shrink-0">
          <div class="flex items-center gap-2 max-w-3xl mx-auto">
            <input
              type="text"
              placeholder="Posez une question sur vos factures..."
              class="flex-1 text-sm px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 dark:focus:border-indigo-600 transition-all disabled:opacity-50"
              [(ngModel)]="question"
              (keyup.enter)="send()"
              [disabled]="streaming()"
            />
            <button
              class="w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 disabled:cursor-not-allowed"
              [class.bg-indigo-600]="canSend()"
              [class.hover:bg-indigo-700]="canSend()"
              [class.text-white]="canSend()"
              [class.bg-zinc-100]="!canSend()"
              [class.dark:bg-zinc-800]="!canSend()"
              [class.text-zinc-400]="!canSend()"
              (click)="send()"
              [disabled]="!canSend()"
            >
              <mat-icon class="!text-lg">send</mat-icon>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AiChat {
  private svc = inject(AiChatService);
  private sanitizer = inject(DomSanitizer);

  conversations = signal<Conversation[]>(this.loadConversations());
  activeId = signal<string | null>(this.loadConversations()[0]?.id ?? null);
  question = signal('');
  streaming = signal(false);

  @ViewChild('messagesEnd') private messagesEnd!: ElementRef<HTMLDivElement>;

  activeMessages = computed<UiMessage[]>(() => {
    const id = this.activeId();
    return this.conversations().find((c) => c.id === id)?.messages ?? [];
  });

  canSend = computed(() => this.question().trim().length > 0 && !this.streaming());

  examples = [
    'Quel est le montant total des factures en attente de validation ?',
    'Quels sont mes 3 principaux fournisseurs ce mois-ci ?',
    'Compare les factures de janvier et février',
  ];

  // ─── Gestion des conversations ────────────────────────────────────────────────

  newConversation(): void {
    const conv: Conversation = {
      id: crypto.randomUUID(),
      title: 'Nouvelle conversation',
      messages: [],
      createdAt: Date.now(),
    };
    this.conversations.update((cs) => [conv, ...cs]);
    this.activeId.set(conv.id);
    this.save();
  }

  selectConversation(id: string): void {
    this.activeId.set(id);
  }

  deleteConversation(id: string): void {
    this.conversations.update((cs) => cs.filter((c) => c.id !== id));
    if (this.activeId() === id) {
      this.activeId.set(this.conversations()[0]?.id ?? null);
    }
    this.save();
  }

  // ─── Persistance ──────────────────────────────────────────────────────────────

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.conversations()));
  }

  private loadConversations(): Conversation[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Conversation[]) : [];
    } catch {
      return [];
    }
  }

  // ─── Envoi ────────────────────────────────────────────────────────────────────

  toolLabel(name: string): string {
    return TOOL_LABELS[name] ?? name;
  }

  renderMarkdown(text: string): SafeHtml {
    const html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  sendExample(example: string): void {
    this.question.set(example);
    this.send();
  }

  async send(): Promise<void> {
    const q = this.question().trim();
    if (!q || this.streaming()) return;

    // Crée une conversation si aucune n'est active
    if (!this.activeId()) {
      this.newConversation();
    }

    this.question.set('');
    this.streaming.set(true);

    // Titre = première question de la conversation (tronquée)
    const isFirstMessage = this.activeMessages().length === 0;

    this.updateActiveMessages((msgs) => [
      ...msgs,
      { role: 'user', content: q, isStreaming: false, steps: [] },
      { role: 'assistant', content: '', isStreaming: true, steps: [] },
    ]);

    if (isFirstMessage) {
      this.setTitle(q.length > 45 ? q.slice(0, 42) + '…' : q);
    }

    this.scrollToBottom();

    try {
      for await (const event of this.svc.stream(q)) {
        this.updateActiveMessages((msgs) => {
          const copy = [...msgs];
          const last = { ...copy[copy.length - 1] };

          if (event.type === 'text_delta') {
            last.content += event.content;
          } else if (event.type === 'tool_use') {
            last.steps = [...last.steps, { name: event.name, done: false }];
          } else if (event.type === 'tool_result') {
            last.steps = last.steps.map((s) =>
              s.name === event.name && !s.done ? { ...s, done: true } : s,
            );
          } else if (event.type === 'done') {
            last.isStreaming = false;
            last.durationMs = event.duration_ms;
          } else if (event.type === 'error') {
            last.isStreaming = false;
            last.error = event.message;
          }

          copy[copy.length - 1] = last;
          return copy;
        });
        this.scrollToBottom();
      }
    } finally {
      this.streaming.set(false);
      this.updateActiveMessages((msgs) => {
        const copy = [...msgs];
        const last = { ...copy[copy.length - 1] };
        if (last.isStreaming) last.isStreaming = false;
        copy[copy.length - 1] = last;
        return copy;
      });
      this.save();
    }
  }

  private updateActiveMessages(fn: (msgs: UiMessage[]) => UiMessage[]): void {
    const id = this.activeId();
    if (!id) return;
    this.conversations.update((cs) =>
      cs.map((c) => (c.id === id ? { ...c, messages: fn(c.messages) } : c)),
    );
  }

  private setTitle(title: string): void {
    const id = this.activeId();
    if (!id) return;
    this.conversations.update((cs) =>
      cs.map((c) => (c.id === id ? { ...c, title } : c)),
    );
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    }, 0);
  }
}
