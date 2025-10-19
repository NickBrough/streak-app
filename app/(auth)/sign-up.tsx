import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { Link } from "expo-router";
import { useAuth } from "@/hooks/useAuth";

export default function SignUp() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>
      <Text style={styles.subtitle}>
        We'll send a confirmation link to your email.
      </Text>
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
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <Button
          title={loading ? "Creating…" : "Sign Up"}
          onPress={async () => {
            setLoading(true);
            setError(null);
            setMessage(null);
            const { error } = await signUp(email.trim(), password);
            setLoading(false);
            if (error) setError(error.message);
            else setMessage("Check your email to confirm.");
          }}
        />
        <Link href="/(auth)/sign-in" asChild>
          <Text style={styles.link}>Already have an account? Sign In</Text>
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
    marginBottom: 20,
  },
  form: {
    gap: 12,
  },
  error: {
    color: "#ef4444",
  },
  message: {
    color: "#20e5e5",
  },
  link: {
    color: "#20e5e5",
    textAlign: "center",
  },
});
