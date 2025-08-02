import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

interface TimePickerModalProps {
  visible: boolean;
  value: string; // "HH:MM" format
  onConfirm: (time: string) => void;
  onCancel: () => void;
  title: string;
}

export const TimePickerModal: React.FC<TimePickerModalProps> = ({
  visible,
  value,
  onConfirm,
  onCancel,
  title,
}) => {
  const [selectedTime, setSelectedTime] = useState(() => {
    // Convert "HH:MM" string to Date object
    const [hours, minutes] = value.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  });

  const handleTimeChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      if (event.type === 'dismissed') {
        onCancel();
        return;
      }
      if (event.type === 'set' && date) {
        const timeString = formatTime(date);
        onConfirm(timeString);
        return;
      }
    }
    
    if (date) {
      setSelectedTime(date);
    }
  };

  const handleConfirm = () => {
    const timeString = formatTime(selectedTime);
    onConfirm(timeString);
  };

  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Android では DateTimePicker がモーダルとして表示されるため、
  // カスタムモーダルは不要
  if (Platform.OS === 'android') {
    return visible ? (
      <DateTimePicker
        value={selectedTime}
        mode="time"
        is24Hour={true}
        display="default"
        onChange={handleTimeChange}
      />
    ) : null;
  }

  // iOS用のカスタムモーダル
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>キャンセル</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={handleConfirm} style={styles.confirmButton}>
              <Text style={styles.confirmButtonText}>設定</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.pickerContainer}>
            <DateTimePicker
              value={selectedTime}
              mode="time"
              is24Hour={true}
              display="wheels"
              onChange={handleTimeChange}
              style={styles.picker}
              textColor="#374151"
            />
          </View>
          
          <View style={styles.footer}>
            <View style={styles.timeDisplay}>
              <Ionicons name="time-outline" size={20} color="#6B7280" />
              <Text style={styles.timeText}>
                設定時刻: {formatTime(selectedTime)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // Safe area bottom
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  confirmButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#4F46E5',
    borderRadius: 8,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  picker: {
    width: '100%',
    height: 200,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  timeText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
});