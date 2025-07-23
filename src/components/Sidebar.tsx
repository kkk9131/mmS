import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { MessageCircle, Hash, Users, Plus, X, Search } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';

interface SidebarProps {
    visible: boolean;
    onClose: () => void;
}

interface Room {
    id: string;
    name: string;
    memberCount: number;
    isJoined: boolean;
    isActive: boolean;
}

const mockRooms: Room[] = [
    { id: '1', name: '夜泣き対策', memberCount: 324, isJoined: true, isActive: true },
    { id: '2', name: '離乳食レシピ', memberCount: 456, isJoined: true, isActive: false },
    { id: '3', name: '保育園情報', memberCount: 234, isJoined: false, isActive: true },
    { id: '4', name: '深夜の愚痴部屋', memberCount: 189, isJoined: true, isActive: true },
    { id: '5', name: '子育てグッズ', memberCount: 387, isJoined: false, isActive: false },
    { id: '6', name: '病気・発熱SOS', memberCount: 278, isJoined: true, isActive: true },
];

const Sidebar: React.FC<SidebarProps> = ({ visible, onClose }) => {
    const [rooms, setRooms] = useState<Room[]>(mockRooms);
    const { theme } = useTheme();

    const joinedRooms = rooms.filter(room => room.isJoined);
    const availableRooms = rooms.filter(room => !room.isJoined);

    const toggleRoomJoin = (roomId: string) => {
        setRooms(rooms.map(room =>
            room.id === roomId ? { ...room, isJoined: !room.isJoined } : room
        ));
    };

    const navigateToRoom = (roomId: string) => {
        const room = rooms.find(r => r.id === roomId);
        if (room) {
            router.push({
                pathname: '/room',
                params: { roomId: room.id, roomName: room.name }
            });
        }
        onClose();
    };

    const navigateToDirectMessages = () => {
        router.push('/chat-list');
        onClose();
    };

    // 動的スタイル
    const dynamicStyles = StyleSheet.create({
        sidebar: {
            width: '85%',
            height: '100%',
            backgroundColor: theme.colors.surface,
            borderRightWidth: 1,
            borderRightColor: theme.colors.border,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 20,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
            paddingTop: 60,
        },
        headerTitle: {
            fontSize: 24,
            fontWeight: 'bold',
            color: theme.colors.primary,
        },
        sectionTitle: {
            fontSize: 18,
            fontWeight: '600',
            color: theme.colors.text.primary,
            marginLeft: 8,
        },
        sectionDescription: {
            fontSize: 14,
            color: theme.colors.text.secondary,
            marginLeft: 28,
            marginBottom: 12,
        },
        emptyText: {
            fontSize: 14,
            color: theme.colors.text.disabled,
            fontStyle: 'italic',
            marginLeft: 28,
        },
        roomItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 8,
            backgroundColor: theme.colors.card,
            marginBottom: 4,
            minHeight: 48,
        },
        roomName: {
            fontSize: 16,
            color: theme.colors.text.primary,
            marginLeft: 8,
        },
        memberCount: {
            fontSize: 12,
            color: theme.colors.text.disabled,
            marginLeft: 4,
            marginRight: 8,
        },
        createRoomDescription: {
            fontSize: 12,
            color: theme.colors.text.secondary,
            lineHeight: 16,
            paddingHorizontal: 4,
        },
        footer: {
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
        },
        searchButton: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.card,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 8,
            justifyContent: 'center',
        },
        searchText: {
            fontSize: 16,
            color: theme.colors.text.secondary,
            marginLeft: 8,
        },
        specialRoomDescription: {
            fontSize: 12,
            color: theme.colors.text.secondary,
            lineHeight: 16,
            paddingHorizontal: 4,
        },
        menuItem: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
        },
        menuText: {
            fontSize: 16,
            color: theme.colors.text.primary,
            marginLeft: 8,
        },
    });

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={dynamicStyles.sidebar}>
                    <View style={dynamicStyles.header}>
                        <Text style={dynamicStyles.headerTitle}>Mamapace</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color={theme.colors.primary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content}>
                        {/* Special Complaint Room */}
                        <View style={styles.section}>
                            <TouchableOpacity
                                style={styles.specialRoomButton}
                                onPress={() => {
                                    router.push('/complaint-room');
                                    onClose();
                                }}
                            >
                                <MessageCircle size={20} color="#fff" />
                                <Text style={styles.specialRoomText}>愚痴もたまにはさ。</Text>
                            </TouchableOpacity>
                            <Text style={dynamicStyles.specialRoomDescription}>
                                匿名で愚痴をポスト。1時間で自動削除されます
                            </Text>
                        </View>

                        {/* Direct Messages Section */}
                        <View style={styles.section}>
                            <TouchableOpacity
                                style={styles.sectionHeader}
                                onPress={navigateToDirectMessages}
                            >
                                <MessageCircle size={20} color="#4a9eff" />
                                <Text style={dynamicStyles.sectionTitle}>チャット</Text>
                            </TouchableOpacity>
                            <Text style={dynamicStyles.sectionDescription}>
                                他のママと直接やり取りができます
                            </Text>
                        </View>

                        {/* Joined Rooms Section */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Hash size={20} color={theme.colors.primary} />
                                <Text style={dynamicStyles.sectionTitle}>参加しているルーム</Text>
                            </View>

                            {joinedRooms.length === 0 ? (
                                <Text style={dynamicStyles.emptyText}>参加しているルームはありません</Text>
                            ) : (
                                joinedRooms.map((room) => (
                                    <TouchableOpacity
                                        key={room.id}
                                        style={dynamicStyles.roomItem}
                                        onPress={() => navigateToRoom(room.id)}
                                    >
                                        <View style={styles.roomInfo}>
                                            <Hash size={16} color={theme.colors.primary} />
                                            <Text style={dynamicStyles.roomName}>{room.name}</Text>
                                            {room.isActive && <View style={styles.activeDot} />}
                                        </View>
                                        <View style={styles.roomMeta}>
                                            <Users size={14} color={theme.colors.text.disabled} />
                                            <Text style={dynamicStyles.memberCount}>{room.memberCount}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            )}
                        </View>

                        {/* Available Rooms Section */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Users size={20} color="#4a9eff" />
                                <Text style={dynamicStyles.sectionTitle}>ルーム</Text>
                            </View>

                            {availableRooms.map((room) => (
                                <TouchableOpacity
                                    key={room.id}
                                    style={dynamicStyles.roomItem}
                                    onPress={() => {
                                        router.push({
                                            pathname: '/room',
                                            params: { roomId: room.id, roomName: room.name }
                                        });
                                        onClose();
                                    }}
                                >
                                    <View style={styles.roomInfo}>
                                        <Hash size={16} color={theme.colors.text.disabled} />
                                        <Text style={dynamicStyles.roomName}>{room.name}</Text>
                                        {room.isActive && <View style={styles.activeDot} />}
                                    </View>
                                    <View style={styles.roomMeta}>
                                        <Users size={14} color={theme.colors.text.disabled} />
                                        <Text style={dynamicStyles.memberCount}>{room.memberCount}</Text>
                                        <TouchableOpacity
                                            style={styles.joinButton}
                                            onPress={() => toggleRoomJoin(room.id)}
                                        >
                                            <Plus size={16} color={theme.colors.primary} />
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Room Creation Section */}
                        <View style={styles.section}>
                            <TouchableOpacity style={styles.createRoomButton}>
                                <Plus size={20} color="#fff" />
                                <Text style={styles.createRoomText}>新しいルームを作成</Text>
                            </TouchableOpacity>
                            <Text style={dynamicStyles.createRoomDescription}>
                                同じ悩みを持つママたちのためのルームを作成できます
                            </Text>
                        </View>
                    </ScrollView>

                    <View style={dynamicStyles.footer}>
                        <TouchableOpacity style={dynamicStyles.searchButton}>
                            <Search size={20} color={theme.colors.text.secondary} />
                            <Text style={dynamicStyles.searchText}>ルームを検索</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-start',
    },
    sidebar: {
        width: '85%',
        height: '100%',
        backgroundColor: '#1a1a1a',
        borderRightWidth: 1,
        borderRightColor: '#333',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        paddingTop: 60,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#ff6b9d',
    },
    closeButton: {
        padding: 8,
        borderRadius: 8,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#e0e0e0',
        marginLeft: 8,
    },
    sectionDescription: {
        fontSize: 14,
        color: '#888',
        marginLeft: 28,
        marginBottom: 12,
    },
    emptyText: {
        fontSize: 14,
        color: '#666',
        fontStyle: 'italic',
        marginLeft: 28,
    },
    roomItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#2a2a2a',
        marginBottom: 4,
        minHeight: 48,
    },
    roomInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    roomName: {
        fontSize: 16,
        color: '#e0e0e0',
        marginLeft: 8,
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#4ade80',
        marginLeft: 8,
    },
    roomMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    memberCount: {
        fontSize: 12,
        color: '#666',
        marginLeft: 4,
        marginRight: 8,
    },
    joinButton: {
        padding: 4,
        borderRadius: 4,
        backgroundColor: '#ff6b9d20',
    },
    createRoomButton: {
        backgroundColor: '#ff6b9d',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 8,
    },
    createRoomText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
        marginLeft: 8,
    },
    createRoomDescription: {
        fontSize: 12,
        color: '#888',
        lineHeight: 16,
        paddingHorizontal: 4,
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#333',
    },
    searchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2a2a2a',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        justifyContent: 'center',
    },
    searchText: {
        fontSize: 16,
        color: '#666',
        marginLeft: 8,
    },
    specialRoomButton: {
        backgroundColor: '#ffa500',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 8,
    },
    specialRoomText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
        marginLeft: 8,
    },
    specialRoomDescription: {
        fontSize: 12,
        color: '#888',
        lineHeight: 16,
        paddingHorizontal: 4,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: '#333',
    },
    menuText: {
        fontSize: 16,
        color: '#e0e0e0',
        marginLeft: 8,
    },
});

export default Sidebar;