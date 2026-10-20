using System.Reflection;
using AwesomeAssertions;
using NetArchTest.Rules;

namespace Orders.ArchitectureTests;

public sealed class LayerTests
{
    private static readonly string[] Frameworks = ["Microsoft.AspNetCore", "Microsoft.EntityFrameworkCore", "System.Net.Http"];

    [Fact]
    public void Domain_DependsOnNoOtherLayerOrFramework() =>
        FailingTypes(Types.InAssembly(Load("Domain")).ShouldNot()
            .HaveDependencyOnAny(["Orders.Application", "Orders.Infrastructure", "Orders.Api", .. Frameworks]))
            .Should().BeEmpty();

    [Fact]
    public void Application_DependsOnNoAdapterOrFramework() =>
        FailingTypes(Types.InAssembly(Load("Application")).ShouldNot()
            .HaveDependencyOnAny(["Orders.Infrastructure", "Orders.Api", .. Frameworks]))
            .Should().BeEmpty();

    [Fact]
    public void Infrastructure_DoesNotDependOnApi() =>
        FailingTypes(Types.InAssembly(Load("Infrastructure")).ShouldNot().HaveDependencyOn("Orders.Api"))
            .Should().BeEmpty();

    // Domain's Error and ErrorKind are the one part of Domain that Api may use, to map failures to responses.
    [Fact]
    public void Endpoints_UseApplicationOnly_OutsideTheCompositionRoot() =>
        FailingTypes(Types.InAssembly(Load("Api"))
            .That().DoNotResideInNamespace("Orders.Api.Configuration").And().DoNotHaveName("Program")
            .ShouldNot().HaveDependencyOnAny(["Orders.Infrastructure", .. DomainTypesOtherThanErrors()]))
            .Should().BeEmpty();

    [Fact]
    public void ProductionClasses_AreSealed_UnlessAbstract() =>
        FailingTypes(Types.InAssemblies([Load("Domain"), Load("Application"), Load("Infrastructure"), Load("Api")])
            .That().AreClasses().And().AreNotAbstract().And().DoNotHaveNameStartingWith("<")
            .And().DoNotResideInNamespace("Orders.Infrastructure.Persistence.Migrations")
            .Should().BeSealed())
            .Should().BeEmpty();

    private static Assembly Load(string layer) => Assembly.Load($"Orders.{layer}");

    private static string[] DomainTypesOtherThanErrors() =>
        [.. Load("Domain").GetExportedTypes().Where(type => type.Name is not ("Error" or "ErrorKind")).Select(type => type.FullName ?? type.Name)];

    private static IEnumerable<string> FailingTypes(ConditionList conditions) => conditions.GetResult().FailingTypeNames ?? [];
}
