<template>
  <div class="poetry-workbench max-w-5xl mx-auto">
    <!-- Workbench Header Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border-paper">
      <!-- Title & Description -->
      <div class="flex items-center gap-3">
        <span class="w-8 h-8 seal-badge text-sm">律</span>
        <div>
          <h2 class="text-lg font-serif font-bold text-ink leading-tight">
            词曲依律填赋
          </h2>
          <p class="text-xs text-ink-muted font-serif mt-0.5">
            153 经典词牌 · 实时平仄分析 · 韵位智能校验
          </p>
        </div>
      </div>

      <!-- Rhyme Book Switcher & Panel toggle -->
      <div class="flex items-center gap-2 text-xs font-serif">
        <span class="text-ink-muted">韵典：</span>
        <button
          v-for="(label, key) in RHYME_BOOK_LABELS"
          :key="key"
          @click="rhymeBook = key"
          class="px-2.5 py-1 rounded transition-colors"
          :class="
            effectiveRhymeBook === key
              ? 'bg-seal/10 text-seal font-medium border border-seal/20'
              : 'text-ink-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5'
          "
        >
          {{ label }}
        </button>

        <span class="text-border-paper mx-1">|</span>

        <button
          @click="panelOpen = !panelOpen"
          class="px-2.5 py-1 rounded border border-border-paper text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          {{ panelOpen ? '隐藏谱说' : '词牌谱说' }}
        </button>
      </div>
    </div>

    <!-- Pattern Selector Row -->
    <div class="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <div class="flex-1">
        <PatternSelector
          :grouped="groupedPatterns"
          :current="currentPattern"
          :selected-id="selectedId"
          @select="selectPattern"
        />
      </div>

      <!-- Draft Status -->
      <div v-if="draftRestored" class="flex items-center gap-2 text-xs font-serif text-amber bg-amber/10 px-3 py-1.5 rounded border border-amber/20">
        <span>已自动恢复上次草稿</span>
        <button @click="clearDraft" class="underline hover:text-seal transition-colors">
          清空
        </button>
      </div>
    </div>

    <!-- Main Workspace Area -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left / Center: Editor & Feedback (8 or 12 columns) -->
      <div :class="panelOpen ? 'lg:col-span-8' : 'lg:col-span-12'" class="space-y-6">
        <!-- Pattern Rhythm Preview -->
        <PatternPreview
          :pattern="activePattern"
          :formats="currentPattern?.formats || []"
          :format-index="formatIndex"
          @change-format="formatIndex = $event"
          @jump="onPreviewJump"
        />

        <!-- Poetry Editor IDE -->
        <PoetryIDE
          ref="ideRef"
          v-model="inputText"
          :pattern="currentPattern"
          :match-results="matchResults"
          :stats="stats"
          :errors="errors"
          :multi-tone-list="multiToneList"
          :rhyme-book="effectiveRhymeBook"
          :rhyme-result="rhymeResult"
          :analyzing="analyzing"
          @char-click="onCharClick"
          @candidate-select="onCandidateSelect"
        />

        <!-- Bottom Feedback Panels: Rhyme Hint & Error Audit -->
        <div class="space-y-4">
          <RhymeHint
            :rhyme-result="rhymeResult"
            :rhyme-book="effectiveRhymeBook"
          />
          <ErrorPanel
            :errors="errors"
            :show-empty="inputText.length > 0"
            @jump="onJumpToError"
          />
        </div>
      </div>

      <!-- Right Column: Cipai Lore & Info Panel -->
      <aside v-show="panelOpen" class="lg:col-span-4 paper-card p-5 sticky top-20">
        <div class="flex items-center justify-between border-b border-border-paper pb-3 mb-4 text-xs font-serif text-ink-muted">
          <span class="font-semibold text-ink">词牌考略与格律释解</span>
          <button @click="panelOpen = false" class="hover:text-seal">
            收起 ✕
          </button>
        </div>
        <CipaiInfoPanel :pattern="activePattern" />
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, watch } from 'vue';
import PatternSelector from './PatternSelector.vue';
import PatternPreview from './PatternPreview.vue';
import PoetryIDE from './PoetryIDE.vue';
import RhymeHint from './RhymeHint.vue';
import ErrorPanel from './ErrorPanel.vue';
import CipaiInfoPanel from './CipaiInfoPanel.vue';

import { usePattern } from '../../poetry-engine/composables/usePattern.js';
import { useAnalysis } from '../../poetry-engine/composables/useAnalysis.js';
import { useDraft } from '../../poetry-engine/composables/useDraft.js';
import { useCipai } from '../../poetry-engine/composables/useCipai.js';

const RHYME_BOOK_LABELS = {
  cilin: '词林正韵',
  pingshui: '平水韵',
  xinyun: '中华新韵',
};

const ideRef = ref(null);
const panelOpen = ref(true);
const formatIndex = ref(0);

// Data
const { list: cipaiList } = useCipai();
const {
  selectedId,
  currentPattern,
  groupedPatterns,
  selectPattern: selectPatternById,
} = usePattern(cipaiList);

const rhymeBook = ref('cilin');

// Active format pattern
const activePattern = computed(() => {
  if (!currentPattern.value) return null;
  const formats = currentPattern.value.formats;
  if (formats && formats.length > 0 && formats[formatIndex.value]) {
    return {
      ...currentPattern.value,
      ...formats[formatIndex.value],
    };
  }
  return currentPattern.value;
});

const effectiveRhymeBook = computed(() => {
  if (currentPattern.value?.source === 'builtin') {
    return rhymeBook.value;
  }
  return rhymeBook.value || 'cilin';
});

// Editor Input Text
const inputText = ref('');

// Auto Draft management
const {
  draftRestored,
  saveDraft,
  clearDraft: clearStoredDraft,
  loadDraft,
} = useDraft(selectedId);

const selectPattern = (pattern) => {
  selectPatternById(pattern.id);
  formatIndex.value = 0;
};

const clearDraft = () => {
  inputText.value = '';
  clearStoredDraft();
};

// Analysis engine
const {
  analyzing,
  matchResults,
  stats,
  errors,
  multiToneList,
  rhymeResult,
  updateMultiToneOverride,
} = useAnalysis({
  text: inputText,
  pattern: activePattern,
  rhymeBook: effectiveRhymeBook,
});

// Jump from preview or error list
const onPreviewJump = (lineIndex) => {
  ideRef.value?.focusLine?.(lineIndex);
};

const onJumpToError = (err) => {
  ideRef.value?.focusChar?.(err.charIndex);
};

const onCharClick = (data) => {};

const onCandidateSelect = ({ charIndex, candidate }) => {
  updateMultiToneOverride(charIndex, candidate);
};

onMounted(() => {
  const saved = loadDraft();
  if (saved) {
    inputText.value = saved;
  }
});

watch(inputText, (newVal) => {
  saveDraft(newVal);
});
</script>
