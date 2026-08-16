export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      conversations: {
        Row: {
          created_at: string | null;
          current_message_leaf_id: string | null;
          id: string;
          privacy: Database['public']['Enums']['privacy_type'];
          settings: Json;
          title: string;
          type: Database['public']['Enums']['conversation-type'];
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          current_message_leaf_id?: string | null;
          id?: string;
          privacy?: Database['public']['Enums']['privacy_type'];
          settings?: Json;
          title: string;
          type?: Database['public']['Enums']['conversation-type'];
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          current_message_leaf_id?: string | null;
          id?: string;
          privacy?: Database['public']['Enums']['privacy_type'];
          settings?: Json;
          title?: string;
          type?: Database['public']['Enums']['conversation-type'];
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      images: {
        Row: {
          conversation_id: string;
          created_at: string;
          id: string;
          image_generation_call_id: string | null;
          prompt: Json;
          status: Database['public']['Enums']['generation-status'];
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          created_at?: string;
          id?: string;
          image_generation_call_id?: string | null;
          prompt?: Json;
          status?: Database['public']['Enums']['generation-status'];
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          id?: string;
          image_generation_call_id?: string | null;
          prompt?: Json;
          status?: Database['public']['Enums']['generation-status'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'images_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
        ];
      };
      meshes: {
        Row: {
          conversation_id: string;
          created_at: string;
          file_type: Database['public']['Enums']['mesh_file_type'];
          id: string;
          images: string[] | null;
          prompt: Json;
          status: Database['public']['Enums']['generation-status'];
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          created_at?: string;
          file_type?: Database['public']['Enums']['mesh_file_type'];
          id?: string;
          images?: string[] | null;
          prompt?: Json;
          status?: Database['public']['Enums']['generation-status'];
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          file_type?: Database['public']['Enums']['mesh_file_type'];
          id?: string;
          images?: string[] | null;
          prompt?: Json;
          status?: Database['public']['Enums']['generation-status'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'meshes_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          conversation_id: string;
          content: Json | null;
          created_at: string;
          id: string;
          metadata: Json;
          parent_message_id: string | null;
          parts: Json;
          rating: number;
          role: string;
        };
        Insert: {
          conversation_id: string;
          content?: Json | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          parent_message_id?: string | null;
          parts?: Json;
          rating?: number;
          role: string;
        };
        Update: {
          conversation_id?: string;
          content?: Json | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          parent_message_id?: string | null;
          parts?: Json;
          rating?: number;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
        ];
      };
      previews: {
        Row: {
          conversation_id: string;
          created_at: string;
          id: string;
          mesh_id: string;
          status: Database['public']['Enums']['generation-status'];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          created_at?: string;
          id?: string;
          mesh_id: string;
          status?: Database['public']['Enums']['generation-status'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          id?: string;
          mesh_id?: string;
          status?: Database['public']['Enums']['generation-status'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'previews_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'previews_mesh_id_fkey';
            columns: ['mesh_id'];
            isOneToOne: false;
            referencedRelation: 'meshes';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          created_at: string;
          full_name: string;
          id: string;
          notifications_enabled: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avatar_path?: string | null;
          created_at?: string;
          full_name: string;
          id?: string;
          notifications_enabled?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avatar_path?: string | null;
          created_at?: string;
          full_name?: string;
          id?: string;
          notifications_enabled?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      prompts: {
        Row: {
          created_at: string;
          id: number;
          type: Database['public']['Enums']['prompt_type'];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          type?: Database['public']['Enums']['prompt_type'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          type?: Database['public']['Enums']['prompt_type'];
          user_id?: string;
        };
        Relationships: [];
      };
      user_ai_preferences: {
        Row: {
          user_id: string;
          hidden_model_ids: string[];
          default_prompt_profile_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          hidden_model_ids?: string[];
          default_prompt_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          hidden_model_ids?: string[];
          default_prompt_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_ai_preferences_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      prompt_profiles: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          prompt_template: string;
          base_revision: string | null;
          archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          prompt_template: string;
          base_revision?: string | null;
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          prompt_template?: string;
          base_revision?: string | null;
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'prompt_profiles_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_providers: {
        Row: {
          id: string;
          user_id: string;
          slug: string;
          name: string;
          driver: string;
          base_url: string;
          credential_ciphertext: string | null;
          credential_iv: string | null;
          credential_tag: string | null;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          slug: string;
          name: string;
          driver: string;
          base_url: string;
          credential_ciphertext?: string | null;
          credential_iv?: string | null;
          credential_tag?: string | null;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          slug?: string;
          name?: string;
          driver?: string;
          base_url?: string;
          credential_ciphertext?: string | null;
          credential_iv?: string | null;
          credential_tag?: string | null;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_providers_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_provider_models: {
        Row: {
          id: string;
          provider_id: string;
          user_id: string;
          model_id: string;
          display_name: string;
          is_visible: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          user_id: string;
          model_id: string;
          display_name: string;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          user_id?: string;
          model_id?: string;
          display_name?: string;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_provider_models_provider_id_fkey';
            columns: ['provider_id'];
            referencedRelation: 'ai_providers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_provider_models_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      trigger_update_updated_at: {
        Args: Record<string, never>;
        Returns: unknown;
      };
    };
    Enums: {
      'conversation-type': 'parametric' | 'creative';
      'generation-status': 'pending' | 'success' | 'failure';
      mesh_file_type: 'glb' | 'stl' | 'obj' | 'fbx';
      mesh_model_type: 'quality' | 'fast';
      privacy_type: 'public' | 'private';
      prompt_type: 'mesh' | 'image' | 'chat';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      'conversation-type': ['parametric', 'creative'],
      'generation-status': ['pending', 'success', 'failure'],
      mesh_file_type: ['glb', 'stl', 'obj', 'fbx'],
      mesh_model_type: ['quality', 'fast'],
      privacy_type: ['public', 'private'],
      prompt_type: ['mesh', 'image', 'chat'],
    },
  },
} as const;
