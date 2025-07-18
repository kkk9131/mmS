import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Heart } from 'lucide-react-native';

interface AIEmpathyBotProps {
    response: string;
}

const AIEmpathyBot: React.FC<AIEmpathyBotProps> = ({ response }) => {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Heart size={14} color="#ff6b9d" fill="#ff6b9d" />
                <Text style={styles.botLabel}>ママの味方</Text>
            </View>
            <Text style={styles.responseText}>{response}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#2a2a2a',
        padding: 12,
        borderRadius: 8,
        marginVertical: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#ff6b9d',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    botLabel: {
        fontSize: 12,
        color: '#ff6b9d',
        fontWeight: '500',
        marginLeft: 6,
    },
    responseText: {
        fontSize: 14,
        color: '#e0e0e0',
        lineHeight: 20,
    },
});

export default AIEmpathyBot;