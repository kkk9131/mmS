import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Heart } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';

interface AIEmpathyBotProps {
    response: string;
}

const AIEmpathyBot: React.FC<AIEmpathyBotProps> = ({ response }) => {
    const { theme } = useTheme();

    // Dynamic styles with theme colors
    const dynamicStyles = StyleSheet.create({
        container: {
            backgroundColor: theme.colors.surface,
            padding: 12,
            borderRadius: 8,
            marginVertical: 8,
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.primary,
        },
        botLabel: {
            fontSize: 12,
            color: theme.colors.primary,
            fontWeight: '500',
            marginLeft: 6,
        },
        responseText: {
            fontSize: 14,
            color: theme.colors.text,
            lineHeight: 20,
        },
    });

    return (
        <View style={dynamicStyles.container}>
            <View style={styles.header}>
                <Heart size={14} color={theme.colors.primary} fill={theme.colors.primary} />
                <Text style={dynamicStyles.botLabel}>ママの味方</Text>
            </View>
            <Text style={dynamicStyles.responseText}>{response}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
});

export default AIEmpathyBot;