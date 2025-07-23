import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Heart, MessageCircle, MoveHorizontal as MoreHorizontal } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';

interface Post {
    id: string;
    content: string;
    author: string;
    timestamp: string;
    likes: number;
    comments: number;
    tags: string[];
    isLiked: boolean;
    aiResponse?: string;
}

interface PostCardProps {
    post: Post;
    onLike: (postId: string) => void;
    onComment: (postId: string) => void;
    onMore: (postId: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, onLike, onComment, onMore }) => {
    const { theme } = useTheme();
    
    const handleLongPress = () => {
        Alert.alert(
            '投稿の操作',
            '実行したい操作を選択してください',
            [
                { text: 'ユーザーをブロック', onPress: () => console.log('Block user'), style: 'destructive' },
                { text: '投稿を報告', onPress: () => console.log('Report post'), style: 'destructive' },
                { text: 'キャンセル', style: 'cancel' }
            ]
        );
    };

    // Dynamic styles with theme colors
    const dynamicStyles = StyleSheet.create({
        container: {
            backgroundColor: theme.colors.cardBackground,
            margin: 10,
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        authorName: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.colors.primary,
        },
        timestamp: {
            fontSize: 12,
            color: theme.colors.textSecondary,
        },
        content: {
            fontSize: 16,
            color: theme.colors.text,
            lineHeight: 24,
            marginBottom: 12,
        },
        tag: {
            fontSize: 14,
            color: theme.colors.accent,
            marginRight: 8,
            marginBottom: 4,
        },
        aiResponseContainer: {
            backgroundColor: theme.colors.surface,
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.primary,
        },
        aiResponseLabel: {
            fontSize: 12,
            color: theme.colors.primary,
            fontWeight: '500',
            marginBottom: 4,
        },
        aiResponseText: {
            fontSize: 14,
            color: theme.colors.text,
            lineHeight: 20,
        },
        actionsContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
        },
        likedButton: {
            backgroundColor: `${theme.colors.primary}20`,
        },
        actionText: {
            fontSize: 14,
            color: theme.colors.textSecondary,
            marginLeft: 6,
        },
        likedText: {
            color: theme.colors.primary,
        },
    });

    return (
        <TouchableOpacity
            style={dynamicStyles.container}
            onLongPress={handleLongPress}
            delayLongPress={800}
        >
            <View style={styles.header}>
                <Text style={dynamicStyles.authorName}>{post.author}</Text>
                <Text style={dynamicStyles.timestamp}>{post.timestamp}</Text>
            </View>

            <Text style={dynamicStyles.content}>{post.content}</Text>

            <View style={styles.tagsContainer}>
                {post.tags.map((tag, index) => (
                    <Text key={index} style={dynamicStyles.tag}>#{tag}</Text>
                ))}
            </View>

            {post.aiResponse && (
                <View style={dynamicStyles.aiResponseContainer}>
                    <Text style={dynamicStyles.aiResponseLabel}>ママの味方</Text>
                    <Text style={dynamicStyles.aiResponseText}>{post.aiResponse}</Text>
                </View>
            )}

            <View style={dynamicStyles.actionsContainer}>
                <TouchableOpacity
                    style={[styles.actionButton, post.isLiked && dynamicStyles.likedButton]}
                    onPress={() => onLike(post.id)}
                >
                    <Heart size={20} color={post.isLiked ? theme.colors.primary : theme.colors.textSecondary} fill={post.isLiked ? theme.colors.primary : 'none'} />
                    <Text style={[dynamicStyles.actionText, post.isLiked && dynamicStyles.likedText]}>
                        {post.likes} 共感
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={() => onComment(post.id)}>
                    <MessageCircle size={20} color={theme.colors.textSecondary} />
                    <Text style={dynamicStyles.actionText}>{post.comments} コメント</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.moreButton} onPress={() => onMore(post.id)}>
                    <MoreHorizontal size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 12,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 20,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        minWidth: 48,
        minHeight: 48,
        justifyContent: 'center',
    },
    moreButton: {
        marginLeft: 'auto',
        padding: 8,
        minWidth: 48,
        minHeight: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default PostCard;