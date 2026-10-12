import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import Svg, { G, Circle } from 'react-native-svg';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  slices: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
  onSliceHover?: (slice: DonutSlice | null) => void;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  slices,
  size = 190,
  strokeWidth = 26,
  centerLabel = 'Total',
  centerValue,
  onSliceHover,
}) => {
  const [activeSlice, setActiveSlice] = useState<DonutSlice | null>(null);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const validSlices = slices.filter((s) => s.value > 0);
  const total = validSlices.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#334155"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
        </Svg>
        <View style={styles.centerTextContainer}>
          <Text style={styles.centerLabel}>Sem dados</Text>
        </View>
      </View>
    );
  }

  function handleSelect(slice: DonutSlice | null) {
    setActiveSlice(slice);
    if (onSliceHover) onSliceHover(slice);
  }

  let accumulatedPercent = 0;

  // Texto exibido no centro (se tiver hover/selecionado, mostra detalhes da fatia)
  const displayLabel = activeSlice ? activeSlice.label : centerLabel;
  const displayValue = activeSlice
    ? `R$ ${activeSlice.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : centerValue;
  const displayPercent = activeSlice
    ? `${((activeSlice.value / total) * 100).toFixed(1)}% da carteira`
    : null;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${center}, ${center}`}>
          {validSlices.map((slice, index) => {
            const percentage = slice.value / total;
            const strokeDasharray = `${circumference * percentage} ${circumference * (1 - percentage)}`;
            const strokeDashoffset = -circumference * accumulatedPercent;
            accumulatedPercent += percentage;

            const isSelected = activeSlice?.label === slice.label;

            return (
              <Circle
                key={index}
                cx={center}
                cy={center}
                r={radius}
                stroke={slice.color}
                strokeWidth={isSelected ? strokeWidth + 6 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                opacity={activeSlice && !isSelected ? 0.35 : 1}
                // Eventos Web / Mobile para Hover e Clique
                {...(Platform.OS === 'web'
                  ? {
                      onMouseEnter: () => handleSelect(slice),
                      onMouseLeave: () => handleSelect(null),
                      style: { cursor: 'pointer', transition: 'all 0.2s ease' } as any,
                    }
                  : {
                      onPress: () => handleSelect(isSelected ? null : slice),
                    })}
              />
            );
          })}
        </G>
      </Svg>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handleSelect(null)}
        style={styles.centerTextContainer}
      >
        <Text numberOfLines={1} style={styles.centerLabel}>
          {displayLabel}
        </Text>
        {displayValue ? (
          <Text numberOfLines={1} style={styles.centerValue}>
            {displayValue}
          </Text>
        ) : null}
        {displayPercent ? (
          <Text style={styles.centerPercent}>{displayPercent}</Text>
        ) : null}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    position: 'relative',
    marginVertical: 12,
  },
  centerTextContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 130,
    paddingHorizontal: 4,
  },
  centerLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  centerValue: {
    fontSize: 14,
    color: '#00C48C',
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'center',
  },
  centerPercent: {
    fontSize: 10,
    color: '#38BDF8',
    fontWeight: '600',
    marginTop: 2,
  },
});
