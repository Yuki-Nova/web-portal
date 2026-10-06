<template>
  <div class="mt-6">
    <button
      v-if="!isOpen"
      type="button"
      class="px-4 py-2 rounded-md border border-seal/30 bg-seal/5 text-xs font-serif text-seal hover:bg-seal/10 transition-colors"
      @click="isOpen = true"
    >
      生成笺纸卡片
    </button>

    <!-- 就地展开预览。本项目**禁止 Vue <Teleport>**（见 AGENTS.md 坑点五），
         故直接以内联块展开，不做弹窗。 -->
    <div v-else class="max-w-md">
      <PoemCardPanel
        :title="title"
        :groups="groups"
        :date="date"
        :tags="tags"
      >
        <template #actions>
          <button
            type="button"
            class="px-3 py-1.5 rounded-md text-xs font-serif text-ink-faint hover:text-ink-muted transition-colors"
            @click="isOpen = false"
          >
            收起
          </button>
        </template>
      </PoemCardPanel>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import PoemCardPanel from './PoemCardPanel.vue';

/**
 * 文章详情页的「生成笺纸卡片」入口岛。
 *
 * 只传一小段数据（标题 + 竖排正文行 + 日期/标签），预览与导出交给
 * `PoemCardPanel.vue`，渲染逻辑在 `utils/poem-card.js`。
 */
defineProps({
  title: { type: String, default: '' },
  /** 竖排正文：外层是原诗的行，内层是按标点断出的短列（见 utils/poem-card.js） */
  groups: { type: Array, default: () => [] },
  date: { type: String, default: '' },
  tags: { type: Array, default: () => [] },
});

const isOpen = ref(false);
</script>
