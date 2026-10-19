namespace Orders.Domain;

/// <summary>The kind of failure, which the inbound adapter maps to a response.</summary>
public enum ErrorKind
{
    /// <summary>The input breaks a rule.</summary>
    Validation,

    /// <summary>The requested item does not exist.</summary>
    NotFound,

    /// <summary>The change conflicts with the current state.</summary>
    Conflict,

    /// <summary>A dependency failed or did not respond.</summary>
    Unavailable,
}
