import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Heart, MessageCircle, MoveHorizontal as MoreHorizontal } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { LazyImage } from './image/LazyImage';
import { ImageViewer } from './image/ImageViewer';

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
    image_url?: string;
    images?: string[];
}

interface PostCardProps {
    post: Post;
    onLike: (postId: string) => void;
    onComment: (postId: string) => void;
    onMore: (postId: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, onLike, onComment, onMore }) => {
    const { theme } = useTheme();
    const [showImageViewer, setShowImageViewer] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    
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

    // 画像クリックハンドラー
    const handleImagePress = (index: number = 0) => {
        setSelectedImageIndex(index);
        setShowImageViewer(true);
    };

    // 画像リストを取得
    const getImageList = (): string[] => {
        if (post.images && post.images.length > 0) {
            return post.images;
        }
        if (post.image_url) {
            // JSONとして保存された複数画像のケースを処理
            try {
                if (post.image_url.startsWith('[')) {
                    return JSON.parse(post.image_url);
                } else {
                    return [post.image_url];
                }
            } catch (error) {
                console.warn('画像URL解析エラー:', error);
                return [post.image_url];
            }
        }
        return [];
    };

    const imageList = getImageList();

    // Dynamic styles with theme colors
    const dynamicStyles = StyleSheet.create({
        container: {
            backgroundColor: theme.colors.card,
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
            color: theme.colors.text.secondary,
        },
        content: {
            fontSize: 16,
            color: theme.colors.text.primary,
            lineHeight: 24,
            marginBottom: 12,
        },
        tag: {
            fontSize: 14,
            color: theme.colors.primary,
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
            color: theme.colors.text.primary,
            lineHeight: 20,
        },
        imageContainer: {
            marginVertical: 12,
        },
        singleImage: {
            width: '100%',
            height: 200,
            borderRadius: 8,
        },
        imageGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 4,
        },
        gridImage: {
            width: '48%',
            height: 120,
            borderRadius: 8,
        },
        imageOverlay: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 8,
        },
        overlayText: {
            color: '#FFFFFF',
            fontSize: 18,
            fontWeight: 'bold',
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
            color: theme.colors.text.secondary,
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

            {/* 画像表示 */}
            {imageList.length > 0 && (
                <View style={dynamicStyles.imageContainer}>
                    {imageList.length === 1 ? (
                        // 唰1枚の場合
                        <TouchableOpacity onPress={() => handleImagePress(0)}>
                            <LazyImage
                                uri={imageList[0]}
                                style={dynamicStyles.singleImage}
                                resizeMode="cover"
                                borderRadius={8}
                                accessibilityLabel="投稿の画像"
                                priority="normal"
                                onPress={() => handleImagePress(0)}
                            />
                        </TouchableOpacity>
                    ) : (
                        // 複数枚の場合
                        <View style={dynamicStyles.imageGrid}>
                            {imageList.slice(0, 4).map((imageUri, index) => (
                                <View key={index} style={{ position: 'relative' }}>
                                    <TouchableOpacity onPress={() => handleImagePress(index)}>
                                        <LazyImage
                                            uri={imageUri}
                                            style={dynamicStyles.gridImage}
                                            resizeMode="cover"
                                            borderRadius={8}
                                            accessibilityLabel={`投稿の画像 ${index + 1}`}
                                            priority="normal"
                                            onPress={() => handleImagePress(index)}
                                        />
                                    </TouchableOpacity>
                                    {/* 4枚以上の場合のオーバーレイ */}
                                    {index === 3 && imageList.length > 4 && (
                                        <TouchableOpacity 
                                            style={dynamicStyles.imageOverlay}
                                            onPress={() => handleImagePress(index)}
                                        >
                                            <Text style={dynamicStyles.overlayText}>
                                                +{imageList.length - 4}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            )}

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
                    <Heart size={20} color={post.isLiked ? theme.colors.primary : theme.colors.text.secondary} fill={post.isLiked ? theme.colors.primary : 'none'} />
                    <Text style={[dynamicStyles.actionText, post.isLiked && dynamicStyles.likedText]}>
                        {post.likes} 共感
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={() => onComment(post.id)}>
                    <MessageCircle size={20} color={theme.colors.text.secondary} />
                    <Text style={dynamicStyles.actionText}>{post.comments} コメント</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.moreButton} onPress={() => onMore(post.id)}>
                    <MoreHorizontal size={20} color={theme.colors.text.secondary} />
                </TouchableOpacity>
            </View>

            {/* 画像ビューワー */}
            {imageList.length > 0 && (
                <ImageViewer
                    visible={showImageViewer}
                    imageUri={imageList[selectedImageIndex]}
                    onClose={() => setShowImageViewer(false)}
                    title={`投稿画像 ${selectedImageIndex + 1}/${imageList.length}`}
                    altText={`${post.author}の投稿画像`}
                    enableDownload={true}
                    enableShare={true}
                />
            )}
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