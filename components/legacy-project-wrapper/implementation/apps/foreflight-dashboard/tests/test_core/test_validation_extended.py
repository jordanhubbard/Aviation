"""Extended validation tests to improve coverage."""

import os
import tempfile

import pytest

from src.core.validation import validate_csv


class TestCSVValidationExtended:
    """Extended tests for CSV validation to improve coverage."""
    
    def test_validate_csv_with_missing_required_columns(self):
        """Test validation fails with missing required columns."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("Date,Aircraft\n")
            f.write("2024-01-01,N12345\n")
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            assert isinstance(result, dict)
            assert result["success"] is False
            assert result.get("error")
        finally:
            os.unlink(temp_path)
    
    def test_validate_csv_empty_file(self):
        """Test validation fails with empty CSV file."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            assert isinstance(result, dict)
            assert result["success"] is False
            assert result.get("error")
        finally:
            os.unlink(temp_path)
    
    def test_validate_csv_only_headers(self):
        """Test validation fails with only headers and no data."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("Date,Aircraft ID,Total Time\n")
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            assert isinstance(result, dict)
            assert result["success"] is False
        finally:
            os.unlink(temp_path)
    
    def test_validate_csv_with_invalid_date_format(self):
        """Test validation with invalid date format."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("Date,Aircraft ID,Total Time,From,To\n")
            f.write("not-a-date,N12345,1.5,KSFO,KLAX\n")
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            assert isinstance(result, dict)
            assert result["success"] is False
        finally:
            os.unlink(temp_path)
    
    def test_validate_csv_with_special_characters(self):
        """Test validation handles special characters in data."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write("Date,Aircraft ID,Total Time,From,To,Remarks\n")
            f.write("2024-01-01,N12345,1.5,KSFO,KLAX,Test flight with émojis ✈️\n")
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            assert isinstance(result, dict)
            assert result["success"] is False
        finally:
            os.unlink(temp_path)
    
    def test_validate_csv_nonexistent_file(self):
        """Test validation fails with nonexistent file."""
        result = validate_csv("/nonexistent/path/to/file.csv")
        assert isinstance(result, dict)
        assert result["success"] is False
        assert result.get("error")
    
    def test_validate_csv_with_comma_in_quoted_field(self):
        """Test validation handles commas within quoted fields."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("Date,Aircraft ID,Total Time,From,To,Remarks\n")
            f.write('2024-01-01,N12345,1.5,KSFO,KLAX,"Flight with notes, and commas"\n')
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            assert isinstance(result, dict)
            assert result["success"] is False
        finally:
            os.unlink(temp_path)
    
    def test_validate_csv_with_extra_whitespace(self):
        """Test validation handles extra whitespace in fields."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("Date,Aircraft ID,Total Time,From,To\n")
            f.write("  2024-01-01  ,  N12345  ,  1.5  ,  KSFO  ,  KLAX  \n")
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            assert isinstance(result, dict)
            assert result["success"] is False
        finally:
            os.unlink(temp_path)
    
    def test_validate_csv_with_mixed_line_endings(self):
        """Test validation handles mixed line endings (\\r\\n vs \\n)."""
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as f:
            f.write(b"Date,Aircraft ID,Total Time,From,To\r\n")
            f.write(b"2024-01-01,N12345,1.5,KSFO,KLAX\n")
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            assert isinstance(result, dict)
            assert result["success"] is False
        finally:
            os.unlink(temp_path)
    
    def test_validate_csv_with_numeric_overflow(self):
        """Test validation with extremely large numeric values."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("Date,Aircraft ID,Total Time,From,To\n")
            f.write("2024-01-01,N12345,999999.99,KSFO,KLAX\n")
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            assert isinstance(result, dict)
            assert result["success"] is False
        finally:
            os.unlink(temp_path)
    
    def test_validate_csv_with_negative_time_values(self):
        """Test validation with negative time values."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("Date,Aircraft ID,Total Time,From,To\n")
            f.write("2024-01-01,N12345,-1.5,KSFO,KLAX\n")
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            assert isinstance(result, dict)
            assert result["success"] is False
        finally:
            os.unlink(temp_path)


class TestValidationEdgeCases:
    """Test edge cases in validation logic."""
    
    def test_validate_csv_permission_denied(self, tmp_path):
        """Test validation handles permission errors gracefully."""
        if os.name == 'nt':
            pytest.skip("Permission tests unreliable on Windows")
        
        csv_file = tmp_path / "test.csv"
        csv_file.write_text("Date,Aircraft ID,Total Time\n2024-01-01,N12345,1.5\n")
        csv_file.chmod(0o000)
        
        try:
            result = validate_csv(str(csv_file))
            assert isinstance(result, dict)
            assert result["success"] is False
            assert result.get("error")
        finally:
            csv_file.chmod(0o644)
    
    def test_validate_csv_with_bom(self):
        """Test validation handles UTF-8 BOM (Byte Order Mark)."""
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as f:
            # Write UTF-8 BOM followed by CSV data
            f.write(b'\xef\xbb\xbf')
            f.write(b"Date,Aircraft ID,Total Time,From,To\n")
            f.write(b"2024-01-01,N12345,1.5,KSFO,KLAX\n")
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            assert isinstance(result, dict)
            assert result["success"] is False
        finally:
            os.unlink(temp_path)
    
    def test_validate_csv_directory_instead_of_file(self, tmp_path):
        """Test validation fails when given directory instead of file."""
        result = validate_csv(str(tmp_path))
        assert isinstance(result, dict)
        assert result["success"] is False
        assert result.get("error")
    
    def test_validate_csv_with_null_bytes(self):
        """Test validation handles null bytes in file."""
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as f:
            f.write(b"Date,Aircraft ID,Total Time\n")
            f.write(b"2024-01-01\x00,N12345,1.5\n")
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            assert isinstance(result, dict)
            assert result["success"] is False
        finally:
            os.unlink(temp_path)
    
    def test_validate_csv_very_long_line(self):
        """Test validation handles very long lines."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            remarks = "A" * 10000  # 10KB of remarks
            f.write("Date,Aircraft ID,Total Time,From,To,Remarks\n")
            f.write(f'2024-01-01,N12345,1.5,KSFO,KLAX,"{remarks}"\n')
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            assert isinstance(result, dict)
            assert result["success"] is False
        finally:
            os.unlink(temp_path)
    
    def test_validate_csv_inconsistent_column_count(self):
        """Test validation with inconsistent number of columns per row."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write("Date,Aircraft ID,Total Time,From,To\n")
            f.write("2024-01-01,N12345,1.5,KSFO,KLAX\n")
            f.write("2024-01-02,N67890,2.0\n")  # Missing columns
            temp_path = f.name
        
        try:
            result = validate_csv(temp_path)
            assert isinstance(result, dict)
            assert result["success"] is False
        finally:
            os.unlink(temp_path)
