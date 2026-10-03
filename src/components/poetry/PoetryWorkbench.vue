<template>
  <div class="poetry-workbench max-w-5xl mx-auto">
    <!-- Workbench Header Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border-paper">
      <!-- Title & Description -->
      <div class="flex items-center gap-3">
        <span class="w-8 h-8 seal-badge text-sm">律</span>
        <div>
          <h2 class="text-lg font-serif font-bold text-ink leading-tight">
            填词
          </h2>
          <p class="text-xs text-ink-muted font-serif mt-0.5">
            153 个词牌 · 平仄与韵脚校验
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
          {{ panelOpen ? '隐藏说明' : '词牌说明' }}
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
          <span class="font-semibold text-ink">词牌说明</span>
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
/**
 * 填词案头容器。
 *
 * 与引擎的接口约定（勿凭印象改，以 composables 实际签名为准）：
 *   useCipai()                          → { list }                       （无参）
 *   usePattern(cipaiListRef)            → { selectedId, currentPattern, groupedPatterns, selectPattern(id) }（位置参数）
 *   useAnalysis(text, pattern, override)→ { analyzing, matchResults, stats, errors,
 *                                           multiToneList, rhymeResult, effectiveRhymeBook, setToneOverride }（位置参数）
 *   useDraft({ text, patternId, rhymeBook }) → { load, clear, hasDraft, restored, savedAt }（对象参数，内部自动落盘）
 */
import { ref, computed, onMounted, nextTick } from 'vue';
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

// 词牌数据与当前格律模板
const { list: cipaiList } = useCipai();
const {
  selectedId,
  currentPattern,
  groupedPatterns,
  selectPattern: selectPatternById,
} = usePattern(cipaiList);

// 用户手动指定的韵书；空串表示交给引擎按体裁自动推导（诗体→新韵，词牌→词林正韵）
const rhymeBook = ref('');

// 编辑器输入
const inputText = ref('');

// 当前格式变体（词牌可含多体）
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

// 分析引擎：位置参数签名 useAnalysis(text, pattern, rhymeBookOverride)
const {
  analyzing,
  matchResults,
  stats,
  errors,
  multiToneList,
  rhymeResult,
  effectiveRhymeBook,
  setToneOverride,
} = useAnalysis(inputText, activePattern, rhymeBook);

// 草稿：对象参数签名；内部已 watch text/patternId/rhymeBook 自动保存，无需外部 saveDraft
const { load: loadDraft, clear: clearStoredDraft } = useDraft({
  text: inputText,
  patternId: selectedId,
  rhymeBook,
});

const draftRestored = ref(false);

// PatternSelector 的 select 事件抛的是词牌 id 字符串（不是对象）
const selectPattern = (id) => {
  selectPatternById(id);
  formatIndex.value = 0;
};

const clearDraft = () => {
  inputText.value = '';
  clearStoredDraft();
  draftRestored.value = false;
};

/**
 * 谱面跳转：目标行尚未创建时自动补空行（旧项目 TODO B1.5）。
 * 例：只输入了第 1 行时点击第 8 行 → 自动补齐到 8 行，再定位光标。
 */
const onPreviewJump = (line, col) => {
  const text = inputText.value;
  const currentLineCount = text === '' ? 1 : text.split('\n').length;
  const targetLine = line + 1;
  if (targetLine > currentLineCount) {
    inputText.value = text + '\n'.repeat(targetLine - currentLineCount);
  }
  // 等 textarea 更新完成后再定位光标，确保目标行已存在
  nextTick(() => {
    ideRef.value?.jumpTo?.(line, col ?? 0);
  });
};

// 错误列表跳转：错误必然出现在已有行上，无需补行
const onJumpToError = (line, col) => {
  ideRef.value?.jumpTo?.(line, col ?? 0);
};

const onCharClick = () => {};

// 多音字候选：EditorTooltip 抛 { line, col, char, candidate }
const onCandidateSelect = ({ line, col, char, candidate }) => {
  if (candidate?.tone) setToneOverride(line, col, char, candidate.tone);
};

onMounted(() => {
  const saved = loadDraft();
  if (saved?.text) {
    inputText.value = saved.text;
    draftRestored.value = true;
  }
});
</script>
