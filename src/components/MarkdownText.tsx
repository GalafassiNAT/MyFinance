import React from 'react';
import { Text, View, StyleSheet, TextStyle, Platform } from 'react-native';

interface MarkdownTextProps {
  content: string;
  style?: TextStyle;
}

/**
 * Renderizador Markdown limpo e ultra-leve em React Native puro (sem bibliotecas externas pesadas).
 * Suporta:
 * - Negrito (**texto**)
 * - Itálico (*texto*)
 * - Títulos (#, ##, ###)
 * - Listas com marcadores (* item, - item)
 * - Código inline (`código`)
 */
export const MarkdownText: React.FC<MarkdownTextProps> = ({ content, style }) => {
  const lines = content.split('\n');

  return (
    <View style={styles.container}>
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();

        // Linha vazia -> espaçamento
        if (!trimmed) {
          return <View key={lineIdx} style={styles.emptyLine} />;
        }

        // Linha divisória horizontal (--- ou *** ou ___ ou com espaços)
        if (/^[-*_]{3,}\s*$/.test(trimmed)) {
          return <View key={lineIdx} style={styles.horizontalRule} />;
        }

        // Título H1 / H2 / H3 / H4 / H5 / H6 (usando regex flexível com ou sem espaço imediato)
        const headingMatch = trimmed.match(/^(#{1,6})\s*(.*)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const headingText = headingMatch[2];
          const headingStyle =
            level === 1
              ? styles.h1
              : level === 2
              ? styles.h2
              : level === 3
              ? styles.h3
              : styles.h4;

          return (
            <Text key={lineIdx} style={[headingStyle, style && { fontSize: undefined }]}>
              {renderInlineStyles(headingText)}
            </Text>
          );
        }

        // Citação / Callout / Blockquote (> texto ou >>> texto)
        const quoteMatch = trimmed.match(/^>+\s*(.*)$/);
        if (quoteMatch) {
          const quoteText = quoteMatch[1];
          return (
            <View key={lineIdx} style={styles.blockquote}>
              <Text style={[styles.blockquoteText, style && { color: undefined }]}>
                {renderInlineStyles(quoteText)}
              </Text>
            </View>
          );
        }

        // Lista com marcadores
        if (/^[-*•]\s+/.test(trimmed)) {
          const itemText = trimmed.replace(/^[-*•]\s+/, '');
          return (
            <View key={lineIdx} style={styles.bulletRow}>
              <Text style={styles.bulletPoint}>•</Text>
              <Text style={[styles.paragraph, style, { flex: 1 }]}>
                {renderInlineStyles(itemText)}
              </Text>
            </View>
          );
        }

        // Parágrafo padrão
        return (
          <Text key={lineIdx} style={[styles.paragraph, style]}>
            {renderInlineStyles(line)}
          </Text>
        );
      })}
    </View>
  );
};

// Parser de estilos inline: **negrito**, *itálico*, `código`
function renderInlineStyles(text: string): React.ReactNode[] {
  // Regex seguro para capturar tokens: **negrito** | *itálico* | `código`
  const regex = /(\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+?`)/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <Text key={idx} style={styles.bold}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <Text key={idx} style={styles.italic}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <Text key={idx} style={styles.code}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    return <Text key={idx}>{part}</Text>;
  });
}

const styles = StyleSheet.create({
  container: {
    gap: 3,
  },
  emptyLine: {
    height: 6,
  },
  horizontalRule: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 8,
    width: '100%',
  },
  paragraph: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 19,
  },
  h1: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00C48C',
    marginTop: 4,
    marginBottom: 2,
  },
  h2: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
    marginTop: 3,
    marginBottom: 2,
  },
  h3: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F8FAFC',
    marginTop: 2,
  },
  h4: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
    marginTop: 2,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginVertical: 4,
  },
  blockquoteText: {
    fontSize: 12,
    color: '#FDE68A',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingLeft: 4,
  },
  bulletPoint: {
    color: '#00C48C',
    fontSize: 13,
    lineHeight: 19,
  },
  bold: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  italic: {
    fontStyle: 'italic',
    color: '#94A3B8',
  },
  code: {
    fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
    backgroundColor: '#0F172A',
    color: '#38BDF8',
    paddingHorizontal: 4,
    borderRadius: 4,
    fontSize: 12,
  },
});
