export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          output_id: string | null
          parent_id: string | null
          project_id: string
          timecode: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          output_id?: string | null
          parent_id?: string | null
          project_id: string
          timecode?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          output_id?: string | null
          parent_id?: string | null
          project_id?: string
          timecode?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_output_id_fkey"
            columns: ["output_id"]
            isOneToOne: false
            referencedRelation: "project_outputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          parent_id: string | null
          read: boolean | null
          receiver_id: string
          sender_id: string
          team_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          read?: boolean | null
          receiver_id: string
          sender_id: string
          team_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          read?: boolean | null
          receiver_id?: string
          sender_id?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          link: string | null
          message: string | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      org_delete_otp: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          organization_id: string
          user_id: string
          verified: boolean
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          organization_id: string
          user_id: string
          verified?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          organization_id?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "org_delete_otp_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          metadata: Json | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          features: Json | null
          id: string
          is_active: boolean | null
          name: string
          price_monthly: number
          price_yearly: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          price_monthly?: number
          price_yearly?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_monthly?: number
          price_yearly?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          notification_assignments: boolean | null
          notification_comments: boolean | null
          notification_email: boolean | null
          notification_mentions: boolean | null
          notification_status_changes: boolean | null
          phone: string | null
          plan: string
          plan_expires_at: string | null
          social_links: Json | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          notification_assignments?: boolean | null
          notification_comments?: boolean | null
          notification_email?: boolean | null
          notification_mentions?: boolean | null
          notification_status_changes?: boolean | null
          phone?: string | null
          plan?: string
          plan_expires_at?: string | null
          social_links?: Json | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          notification_assignments?: boolean | null
          notification_comments?: boolean | null
          notification_email?: boolean | null
          notification_mentions?: boolean | null
          notification_status_changes?: boolean | null
          phone?: string | null
          plan?: string
          plan_expires_at?: string | null
          social_links?: Json | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      project_activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          project_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          project_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          project_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string | null
          id: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_outputs: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          is_video: boolean | null
          project_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_video?: boolean | null
          project_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_video?: boolean | null
          project_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_outputs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          created_at: string
          default_description: string | null
          default_title: string | null
          description: string | null
          icon: string | null
          id: string
          job_type: Database["public"]["Enums"]["job_type"]
          name: string
        }
        Insert: {
          created_at?: string
          default_description?: string | null
          default_title?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          job_type?: Database["public"]["Enums"]["job_type"]
          name: string
        }
        Update: {
          created_at?: string
          default_description?: string | null
          default_title?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          job_type?: Database["public"]["Enums"]["job_type"]
          name?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          approver_id: string | null
          assigned_date: string | null
          assigned_to: string | null
          created_at: string | null
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          job_type: Database["public"]["Enums"]["job_type"]
          job_type_custom: string | null
          organization_id: string | null
          priority: Database["public"]["Enums"]["project_priority"]
          project_code: string | null
          reviewer_id: string | null
          status: Database["public"]["Enums"]["project_status"]
          team_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          approver_id?: string | null
          assigned_date?: string | null
          assigned_to?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          job_type?: Database["public"]["Enums"]["job_type"]
          job_type_custom?: string | null
          organization_id?: string | null
          priority?: Database["public"]["Enums"]["project_priority"]
          project_code?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          team_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          approver_id?: string | null
          assigned_date?: string | null
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          job_type?: Database["public"]["Enums"]["job_type"]
          job_type_custom?: string | null
          organization_id?: string | null
          priority?: Database["public"]["Enums"]["project_priority"]
          project_code?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          team_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          comment_id: string | null
          created_at: string
          emoji: string
          id: string
          message_id: string | null
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          emoji: string
          id?: string
          message_id?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          cancelled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          plan_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_cycle?: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end: string
          current_period_start?: string
          id?: string
          plan_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_cycle?: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          status: string
          team_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          status?: string
          team_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          status?: string
          team_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string | null
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      extract_mentions: { Args: { content: string }; Returns: string[] }
      generate_org_project_code: { Args: { org_id: string }; Returns: string }
      generate_otp_code: { Args: never; Returns: string }
      generate_project_code: { Args: never; Returns: string }
      has_project_access: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      has_project_role: {
        Args: {
          _project_id: string
          _role: Database["public"]["Enums"]["project_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_owner: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      job_type: "video_editing" | "design" | "website" | "other"
      org_role: "admin" | "member"
      project_priority: "high" | "medium" | "low"
      project_role: "owner" | "editor" | "viewer"
      project_status:
        | "pending"
        | "in_progress"
        | "review"
        | "completed"
        | "draft"
        | "assigned"
        | "on_progress"
        | "revision"
        | "delivered"
        | "closed"
        | "approved"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      job_type: ["video_editing", "design", "website", "other"],
      org_role: ["admin", "member"],
      project_priority: ["high", "medium", "low"],
      project_role: ["owner", "editor", "viewer"],
      project_status: [
        "pending",
        "in_progress",
        "review",
        "completed",
        "draft",
        "assigned",
        "on_progress",
        "revision",
        "delivered",
        "closed",
        "approved",
      ],
    },
  },
} as const
