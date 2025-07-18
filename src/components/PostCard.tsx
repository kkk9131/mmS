import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Heart, MessageCircle, MoveHorizontal as MoreHorizontal } from 'lucide-react-native';

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

    return (
        <TouchableOpacity
            style={styles.container}
            onLongPress={handleLongPress}
            delayLongPress={800}
        >
            <View style={styles.header}>
                <Text style={styles.authorName}>{post.author}</Text>
                <Text style={styles.timestamp}>{post.timestamp}</Text>
            </View>

            <Text style={styles.content}>{post.content}</Text>

            <View style={styles.tagsContainer}>
                {post.tags.map((tag, index) => (
                    <Text key={index} style={styles.tag}>#{tag}</Text>
                ))}
            </View>

            {post.aiResponse && (
                <View style={styles.aiResponseContainer}>
                    <Text style={styles.aiResponseLabel}>ママの味方</Text>
                    <Text style={styles.aiResponseText}>{post.aiResponse}</Text>
                </View>
            )}

            <View style={styles.actionsContainer}>
                <TouchableOpacity
                    style={[styles.actionButton, post.isLiked && styles.likedButton]}
                    onPress={() => onLike(post.id)}
                >
                    <Heart size={20} color={post.isLiked ? '#ff6b9d' : '#666'} fill={post.isLiked ? '#ff6b9d' : 'none'} />
                    <Text style={[styles.actionText, post.isLiked && styles.likedText]}>
                        {post.likes} 共感
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={() => onComment(post.id)}>
                    <MessageCircle size={20} color="#666" />
                    <Text style={styles.actionText}>{post.comments} コメント</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.moreButton} onPress={() => onMore(post.id)}>
                    <MoreHorizontal size={20} color="#666" />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#1a1a1a',
        margin: 10,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    authorName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ff6b9d',
    },
    timestamp: {
        fontSize: 12,
        color: '#888',
    },
    content: {
        fontSize: 16,
        color: '#e0e0e0',
        lineHeight: 24,
        marginBottom: 12,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 12,
    },
    tag: {
        fontSize: 14,
        color: '#4a9eff',
        marginRight: 8,
        marginBottom: 4,
    },
    aiResponseContainer: {
        backgroundColor: '#2a2a2a',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#ff6b9d',
    },
    aiResponseLabel: {
        fontSize: 12,
        color: '#ff6b9d',
        fontWeight: '500',
        marginBottom: 4,
    },
    aiResponseText: {
        fontSize: 14,
        color: '#e0e0e0',
        lineHeight: 20,
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#333',
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
    likedButton: {
        backgroundColor: '#ff6b9d20',
    },
    actionText: {
        fontSize: 14,
        color: '#666',
        marginLeft: 6,
    },
    likedText: {
        color: '#ff6b9d',
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