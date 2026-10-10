import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useI18n, type Language} from '../lib/i18n';

const OPTIONS: {value: Language; label: string}[] = [
  {value: 'es', label: 'ES'},
  {value: 'en', label: 'EN'},
];

/** Selector de idioma ES / EN. */
export default function LanguageToggle() {
  const {language, setLanguage} = useI18n();
  return (
    <View style={styles.container} accessibilityRole="radiogroup">
      {OPTIONS.map(option => (
        <TouchableOpacity
          key={option.value}
          accessibilityRole="radio"
          accessibilityState={{selected: language === option.value}}
          style={[styles.option, language === option.value && styles.optionActive]}
          onPress={() => setLanguage(option.value)}>
          <Text style={[styles.label, language === option.value && styles.labelActive]}>🌐 {option.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#334155',
  },
  option: {paddingHorizontal: 14, paddingVertical: 6, borderRadius: 9},
  optionActive: {backgroundColor: '#3b82f6'},
  label: {color: '#94a3b8', fontSize: 13, fontWeight: '600'},
  labelActive: {color: '#ffffff'},
});
