import { StyleSheet, View } from 'react-native';

import { theme } from '../theme';

interface FakeQrCodeProps {
  value: string;
}

const moduleCount = theme.layout.qrCodeModuleCount;
const moduleSize = theme.layout.qrCodeSize / moduleCount;

export function FakeQrCode({ value }: FakeQrCodeProps) {
  const cells = buildFakeQrMatrix(value);

  return (
    <View accessibilityLabel={`Fake payment QR code ${value}`} style={styles.quietZone}>
      <View style={styles.matrix}>
        {cells.map((active, index) => (
          <View
            key={index}
            style={[
              styles.module,
              { backgroundColor: active ? theme.colors.textPrimary : theme.colors.surface },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function buildFakeQrMatrix(value: string): boolean[] {
  const seed = hash(value);
  return Array.from({ length: moduleCount * moduleCount }, (_, index) => {
    const row = Math.floor(index / moduleCount);
    const column = index % moduleCount;
    const finder = finderPixel(row, column, 0, 0)
      ?? finderPixel(row, column, 0, moduleCount - 7)
      ?? finderPixel(row, column, moduleCount - 7, 0);
    if (finder !== null) return finder;
    return mix(seed, row, column) % 5 < 2;
  });
}

function finderPixel(row: number, column: number, top: number, left: number): boolean | null {
  const localRow = row - top;
  const localColumn = column - left;
  if (localRow < 0 || localRow >= 7 || localColumn < 0 || localColumn >= 7) return null;
  return localRow === 0 || localRow === 6 || localColumn === 0 || localColumn === 6
    || (localRow >= 2 && localRow <= 4 && localColumn >= 2 && localColumn <= 4);
}

function hash(value: string): number {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}

function mix(seed: number, row: number, column: number): number {
  let result = seed ^ Math.imul(row + 1, 374761393) ^ Math.imul(column + 1, 668265263);
  result = Math.imul(result ^ (result >>> 13), 1274126177);
  return (result ^ (result >>> 16)) >>> 0;
}

const styles = StyleSheet.create({
  matrix: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    height: theme.layout.qrCodeSize,
    width: theme.layout.qrCodeSize,
  },
  module: {
    height: moduleSize,
    width: moduleSize,
  },
  quietZone: {
    alignSelf: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
  },
});
