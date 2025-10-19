import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Link, router } from "expo-router";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";

export default function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Streak</Text>
      <Text style={styles.subtitle}>Build your daily fitness habit</Text>
      <View style={styles.form}>
        <Input
          placeholder="Email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Input
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          title={loading ? "Signing in…" : "Sign In"}
          onPress={async () => {
            setLoading(true);
            setError(null);
            const { error } = await signIn(email.trim(), password);
            setLoading(false);
            if (error) setError(error.message);
            else router.replace("/");
          }}
        />
        <View style={{ height: 4 }} />
        <Link href="/(auth)/sign-up" asChild>
          <Text style={styles.link}>Create an account</Text>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0f14",
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#e6f0f2",
    marginBottom: 8,
  },
  subtitle: {
    color: "#94a3b8",
    marginBottom: 24,
  },
  form: {
    width: "100%",
    gap: 12,
  },
  error: {
    color: "#ef4444",
    textAlign: "center",
  },
  link: {
    color: "#20e5e5",
    textAlign: "center",
  },
});
