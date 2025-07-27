import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Heart, MessageCircle, MoveHorizontal as MoreHorizontal } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { LazyImage } from './image/LazyImage';
import { ImageViewer } from './image/ImageViewer';

import { Post } from '../types/posts';

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
            accessible={true}
            accessibilityRole="none"
            accessibilityLabel={`${post.authorName}の投稿`}
            accessibilityHint="長押しで追加の操作メニューを表示"
        >
            <View style={styles.header} accessible={true} accessibilityRole="none">
                <Text style={dynamicStyles.authorName} accessibilityRole="text">{post.authorName}</Text>
                <Text style={dynamicStyles.timestamp} accessibilityRole="text" accessibilityLabel={`投稿日時: ${post.createdAt}`}>{new Date(post.createdAt).toLocaleString()}</Text>
            </View>

            <Text style={dynamicStyles.content} accessible={true} accessibilityRole="text" accessibilityLabel={`投稿内容: ${post.content}`}>{post.content}</Text>

            {/* 画像表示 */}
            {imageList.length > 0 && (
                <View style={dynamicStyles.imageContainer}>
                    {imageList.length === 1 ? (
                        // 画像1枚の場合
                        <TouchableOpacity 
                            onPress={() => handleImagePress(0)}
                            accessible={true}
                            accessibilityRole="imagebutton"
                            accessibilityLabel="投稿画像、タップして拡大表示"
                        >
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
                                    <TouchableOpacity 
                                        onPress={() => handleImagePress(index)}
                                        accessible={true}
                                        accessibilityRole="imagebutton"
                                        accessibilityLabel={`投稿画像 ${index + 1}/${imageList.length}、タップして拡大表示`}
                                    >
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
                                            accessible={true}
                                            accessibilityRole="button"
                                            accessibilityLabel={`他${imageList.length - 4}枚の画像を表示`}
                                        >
                                            <Text style={dynamicStyles.overlayText} accessibilityElementsHidden={true}>
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

            {/* タグ機能は現在の型定義にないためコメントアウト */}
            {/* <View style={styles.tagsContainer} accessible={true} accessibilityRole="list" accessibilityLabel={`タグ: ${post.tags.join(', ')}`}>
                {post.tags.map((tag, index) => (
                    <Text key={index} style={dynamicStyles.tag} accessibilityRole="none">#{tag}</Text>
                ))}
            </View> */}

            {/* AIレスポンス機能は現在の型定義にないためコメントアウト */}
            {/* {post.aiResponse && (
                <View style={dynamicStyles.aiResponseContainer} accessible={true} accessibilityRole="none" accessibilityLabel="AIによる共感メッセージ">
                    <Text style={dynamicStyles.aiResponseLabel} accessibilityRole="text">ママの味方</Text>
                    <Text style={dynamicStyles.aiResponseText} accessibilityRole="text">{post.aiResponse}</Text>
                </View>
            )} */}

            <View style={dynamicStyles.actionsContainer}>
                <TouchableOpacity
                    style={[styles.actionButton, post.isLiked && dynamicStyles.likedButton]}
                    onPress={() => onLike(post.id)}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={post.isLiked ? `${post.likesCount}件の共感、共感を取り消す` : `${post.likesCount}件の共感、共感する`}
                    accessibilityState={{ selected: post.isLiked }}
                >
                    <Heart size={20} color={post.isLiked ? theme.colors.primary : theme.colors.text.secondary} fill={post.isLiked ? theme.colors.primary : 'none'} />
                    <Text style={[dynamicStyles.actionText, post.isLiked && dynamicStyles.likedText]}>
                        {post.likesCount} 共感
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.actionButton} 
                    onPress={() => onComment(post.id)}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`${post.commentsCount}件のコメント、コメントを追加する`}
                    accessibilityHint="タップしてコメントを表示または追加"
                >
                    <MessageCircle size={20} color={theme.colors.text.secondary} />
                    <Text style={dynamicStyles.actionText}>{post.commentsCount} コメント</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.moreButton} 
                    onPress={() => onMore(post.id)}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="その他のオプション"
                    accessibilityHint="投稿の追加操作メニューを表示"
                >
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
                    altText={`${post.authorName}の投稿画像`}
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