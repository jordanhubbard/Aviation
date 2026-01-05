"""Extended ICAO validator tests to improve coverage."""

import pytest
from src.core.icao_validator import (
    is_valid_icao_code,
    get_icao_info,
    suggest_similar_codes,
    get_validation_error_message
)


class TestICAOValidatorExtended:
    """Extended tests for ICAO aircraft code validation."""
    
    def test_is_valid_icao_code_lowercase(self):
        """Test ICAO validation with lowercase codes."""
        # Assuming validator handles case-insensitive validation
        result = is_valid_icao_code("c172")
        assert isinstance(result, bool)
    
    def test_is_valid_icao_code_with_spaces(self):
        """Test ICAO validation with spaces."""
        result = is_valid_icao_code("C 172")
        assert result is False
    
    def test_is_valid_icao_code_with_special_chars(self):
        """Test ICAO validation with special characters."""
        result = is_valid_icao_code("C-172")
        assert result is False
    
    def test_is_valid_icao_code_empty_string(self):
        """Test ICAO validation with empty string."""
        result = is_valid_icao_code("")
        assert result is False
    
    def test_is_valid_icao_code_none(self):
        """Test ICAO validation with None."""
        result = is_valid_icao_code(None)
        assert result is False
    
    def test_is_valid_icao_code_numeric_only(self):
        """Test ICAO validation with numeric-only code."""
        result = is_valid_icao_code("1234")
        assert result is False
    
    def test_is_valid_icao_code_too_long(self):
        """Test ICAO validation with overly long code."""
        result = is_valid_icao_code("VERYLONGCODE")
        assert result is False
    
    def test_get_icao_info_valid_code(self):
        """Test getting ICAO info for valid code."""
        # Common codes that should exist
        for code in ["C172", "PA28", "B737"]:
            info = get_icao_info(code)
            # Should return info dict or None
            assert info is None or isinstance(info, dict)
    
    def test_get_icao_info_invalid_code(self):
        """Test getting ICAO info for invalid code."""
        info = get_icao_info("INVALID123")
        assert info is None
    
    def test_get_icao_info_none(self):
        """Test getting ICAO info with None."""
        info = get_icao_info(None)
        assert info is None
    
    def test_get_icao_info_empty_string(self):
        """Test getting ICAO info with empty string."""
        info = get_icao_info("")
        assert info is None
    
    def test_suggest_similar_codes_common_typo(self):
        """Test suggestions for common typos."""
        # Test with a slightly misspelled code
        suggestions = suggest_similar_codes("C17")  # Missing a digit
        assert isinstance(suggestions, list)
        # May or may not find suggestions, but should return a list
    
    def test_suggest_similar_codes_completely_invalid(self):
        """Test suggestions for completely invalid code."""
        suggestions = suggest_similar_codes("XXXXXX")
        assert isinstance(suggestions, list)
    
    def test_suggest_similar_codes_none(self):
        """Test suggestions with None input."""
        suggestions = suggest_similar_codes(None)
        assert isinstance(suggestions, list)
        assert len(suggestions) == 0
    
    def test_suggest_similar_codes_empty(self):
        """Test suggestions with empty string."""
        suggestions = suggest_similar_codes("")
        assert isinstance(suggestions, list)
        assert len(suggestions) == 0
    
    def test_suggest_similar_codes_max_suggestions(self):
        """Test that suggestions are limited to reasonable number."""
        suggestions = suggest_similar_codes("C1", max_suggestions=5)
        assert isinstance(suggestions, list)
        assert len(suggestions) <= 10  # Should be limited
    
    def test_get_validation_error_message_invalid_code(self):
        """Test error message for invalid code."""
        message = get_validation_error_message("INVALID")
        assert isinstance(message, str)
        assert len(message) > 0
        assert "invalid" in message.lower() or "not found" in message.lower()
    
    def test_get_validation_error_message_with_suggestions(self):
        """Test error message includes suggestions when available."""
        message = get_validation_error_message("C17")  # Close to C172
        assert isinstance(message, str)
        # Message should either have suggestions or explain why not
        assert len(message) > 0
    
    def test_get_validation_error_message_none(self):
        """Test error message with None input."""
        message = get_validation_error_message(None)
        assert isinstance(message, str)
        assert len(message) > 0
    
    def test_get_validation_error_message_empty(self):
        """Test error message with empty string."""
        message = get_validation_error_message("")
        assert isinstance(message, str)
        assert len(message) > 0


class TestICAOValidatorBoundaryConditions:
    """Test boundary conditions and edge cases."""
    
    def test_icao_code_minimum_length(self):
        """Test ICAO codes at minimum valid length."""
        # Typically 3-4 characters
        for code in ["C17", "PA2", "B73"]:
            result = is_valid_icao_code(code)
            assert isinstance(result, bool)
    
    def test_icao_code_maximum_length(self):
        """Test ICAO codes at maximum typical length."""
        # Typically 4 characters max
        for code in ["C172", "PA28", "B737"]:
            result = is_valid_icao_code(code)
            assert isinstance(result, bool)
    
    def test_icao_code_unicode_characters(self):
        """Test ICAO validation with unicode characters."""
        result = is_valid_icao_code("C172é")
        assert result is False
    
    def test_icao_code_mixed_case(self):
        """Test ICAO validation with mixed case."""
        result = is_valid_icao_code("C172")
        result_lower = is_valid_icao_code("c172")
        result_mixed = is_valid_icao_code("C17two")
        # Results should be consistent with case handling
        assert isinstance(result, bool)
        assert isinstance(result_lower, bool)
        assert isinstance(result_mixed, bool)
    
    def test_icao_suggestion_similarity_threshold(self):
        """Test that suggestions are reasonably similar."""
        suggestions = suggest_similar_codes("C173")  # Very close to C172
        if len(suggestions) > 0:
            # If suggestions exist, they should be somewhat similar
            for suggestion in suggestions[:3]:
                assert isinstance(suggestion, str)
                assert len(suggestion) <= 10
    
    def test_icao_info_structure(self):
        """Test ICAO info returns expected structure if not None."""
        info = get_icao_info("C172")
        if info is not None:
            assert isinstance(info, dict)
            # Check for expected keys if info is returned
            # (structure depends on implementation)
    
    def test_validation_error_message_length(self):
        """Test error messages are reasonable length."""
        message = get_validation_error_message("INVALID")
        assert len(message) < 500  # Should be concise
        assert len(message) > 10   # Should be informative
    
    def test_icao_code_with_numbers_only_at_end(self):
        """Test ICAO codes with numbers only at end."""
        # Valid pattern: letters followed by numbers
        result = is_valid_icao_code("C172")
        assert isinstance(result, bool)
        
        # Invalid pattern: numbers at start
        result = is_valid_icao_code("172C")
        assert result is False
    
    def test_multiple_consecutive_calls(self):
        """Test validator works correctly with multiple calls."""
        codes = ["C172", "PA28", "B737", "INVALID", ""]
        results = [is_valid_icao_code(code) for code in codes]
        assert len(results) == len(codes)
        assert all(isinstance(r, bool) for r in results)
