import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PushNotificationPayload {
  to: string;
  sound: string;
  title: string;
  body: string;
  data: Record<string, any>;
  priority: 'default' | 'normal' | 'high';
  channelId?: string;
  badge?: number;
}

interface NotificationRequest {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  actionUrl: string;
}

serve(async (req) => {
  // CORSプリフライトリクエストの処理
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Supabaseクライアントの初期化
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // リクエストボディの解析
    const notificationRequest: NotificationRequest = await req.json()
    
    const { userId, type, title, message, data = {}, actionUrl } = notificationRequest

    // ユーザーの通知設定を取得
    const { data: settings, error: settingsError } = await supabaseClient
      .from('notification_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (settingsError && settingsError.code !== 'PGRST116') {
      throw new Error(`通知設定取得失敗: ${settingsError.message}`)
    }

    // プッシュ通知が無効の場合はスキップ
    if (settings && !settings.push_enabled) {
      return new Response(
        JSON.stringify({ message: 'プッシュ通知が無効です' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 通知タイプ別の有効性チェック
    if (settings) {
      const typeEnabledMap: Record<string, boolean> = {
        'like': settings.likes_enabled,
        'comment': settings.comments_enabled,
        'follow': settings.follows_enabled,
        'message': settings.messages_enabled,
        'mention': settings.mentions_enabled,
        'post_reply': settings.comments_enabled,
        'system': true,
      }

      if (!typeEnabledMap[type]) {
        return new Response(
          JSON.stringify({ message: `通知タイプ ${type} が無効です` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // おやすみモードのチェック
    if (settings && settings.quiet_hours_start && settings.quiet_hours_end) {
      const now = new Date()
      const currentTime = now.getHours() * 60 + now.getMinutes()
      
      const [startHour, startMin] = settings.quiet_hours_start.split(':').map(Number)
      const [endHour, endMin] = settings.quiet_hours_end.split(':').map(Number)
      
      const quietStart = startHour * 60 + startMin
      const quietEnd = endHour * 60 + endMin
      
      let isQuietHours = false
      if (quietStart > quietEnd) {
        // 日をまたぐ場合
        isQuietHours = currentTime >= quietStart || currentTime < quietEnd
      } else {
        isQuietHours = currentTime >= quietStart && currentTime < quietEnd
      }
      
      // 緊急通知かどうかのチェック
      const isEmergency = type === 'system' || 
        title.includes('緊急') || 
        title.includes('重要') ||
        message.includes('緊急') || 
        message.includes('重要')
      
      if (isQuietHours && !isEmergency) {
        return new Response(
          JSON.stringify({ message: 'おやすみモード中のため通知をスキップしました' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // データベースに通知レコードを作成
    const { data: notification, error: dbError } = await supabaseClient
      .from('notifications')
      .insert({
        user_id: userId,
        type: type,
        title: title,
        message: message,
        data: data,
        is_read: false,
      })
      .select()
      .single()

    if (dbError) {
      throw new Error(`通知レコード作成失敗: ${dbError.message}`)
    }

    // ユーザーのアクティブなプッシュトークンを取得
    const { data: tokens, error: tokensError } = await supabaseClient
      .from('push_tokens')
      .select('token, platform')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (tokensError) {
      throw new Error(`プッシュトークン取得失敗: ${tokensError.message}`)
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'プッシュトークンが見つかりません',
          notificationId: notification.id 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Expo Push APIを使用してプッシュ通知を送信
    const expoPushUrl = 'https://exp.host/--/api/v2/push/send'
    
    const pushMessages: PushNotificationPayload[] = tokens.map(tokenData => ({
      to: tokenData.token,
      sound: 'default',
      title: title,
      body: message,
      data: {
        notificationId: notification.id,
        type: type,
        actionUrl: actionUrl,
        userId: userId,
        ...data,
      },
      priority: getPushPriority(type),
      channelId: 'default',
    }))

    // バッチでプッシュ通知を送信
    const response = await fetch(expoPushUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pushMessages),
    })

    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(`Expo Push API エラー: ${JSON.stringify(result)}`)
    }

    // 失敗したトークンの処理
    if (result.data) {
      for (let i = 0; i < result.data.length; i++) {
        const ticket = result.data[i]
        if (ticket.status === 'error') {
          console.error(`プッシュ通知送信失敗:`, ticket.details)
          
          // トークンが無効な場合は無効化
          if (ticket.details?.error === 'DeviceNotRegistered') {
            await supabaseClient
              .from('push_tokens')
              .update({ is_active: false })
              .eq('token', tokens[i].token)
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'プッシュ通知送信完了',
        notificationId: notification.id,
        sentCount: tokens.length,
        result: result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('プッシュ通知送信エラー:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function getPushPriority(type: string): 'default' | 'normal' | 'high' {
  const priorityMap: Record<string, 'default' | 'normal' | 'high'> = {
    'system': 'high',
    'message': 'high',
    'mention': 'high',
    'comment': 'normal',
    'post_reply': 'normal',
    'follow': 'normal',
    'like': 'default',
  }

  return priorityMap[type] || 'default'
}